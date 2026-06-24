import { z } from 'zod';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import * as fs from '../fs.js';
import { query_graph, update_kb } from '../graph.js';
import { analyzeFileImportance } from '../graph-importance.js';
import { relink_dir } from '../link.js';
import { save_note, list_pending, read_pending, delete_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { load_workflow } from '../workflow.js';
import * as jobs from '../jobs.js';
import { slugify } from '../slug.js';

function git_mtime(path) {
	try {
		const iso = execSync(`git log -1 --format=%cI -- "${path}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
		if (iso) return iso.split('T')[0];
	} catch { /* not in git */ }
	try { return statSync(path).mtime.toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; }
}

function autofill_frontmatter(path) {
	if (!existsSync(path)) return false;
	let text = readFileSync(path, 'utf8');
	const fm_match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	let body_block = fm_match ? fm_match[1] : '';
	const has = key => new RegExp(`^${key}:`, 'm').test(body_block);
	const additions = [];
	if (!has('type')) additions.push('type: source');
	if (!has('date')) additions.push(`date: ${git_mtime(path)}`);
	if (!has('tags')) additions.push('tags: []');
	if (!additions.length) return false;
	if (fm_match) {
		const new_fm = (body_block.trimEnd() + '\n' + additions.join('\n')).trim();
		text = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${new_fm}\n---`);
	} else {
		text = `---\n${additions.join('\n')}\n---\n\n` + text;
	}
	writeFileSync(path, text);
	return true;
}

function est_learn_seconds() {
	try {
		const n = readdirSync(fs.pending()).filter(f => f.endsWith('.md')).length;
		return Math.max(5, Math.min(300, Math.round(n * 0.5)));
	} catch { return 5; }
}

function get_tier_state() {
	try {
		const stateFile = join(fs.root(), 'vicky', '.tier-state.json');
		if (existsSync(stateFile)) {
			return JSON.parse(readFileSync(stateFile, 'utf8'));
		}
	} catch (_) {}
	return { current_tier: 0, tiers_completed: [] };
}

function save_tier_state(state) {
	try {
		const stateFile = join(fs.root(), 'vicky', '.tier-state.json');
		writeFileSync(stateFile, JSON.stringify(state, null, 2));
	} catch (_) {}
}

function get_next_tier(coverage) {
	// Find first tier < 100% indexed
	if (!coverage || !coverage.tiers) return 0;
	for (const tier of coverage.tiers) {
		if (tier.coverage < 100) return tier.tier;
	}
	// All tiers done
	return coverage.tiers.length > 0 ? coverage.tiers[coverage.tiers.length - 1].tier : 0;
}

export function register(server, notify) {
	server.registerTool('learn', {
		description: 'Fully automatic tier-progressive KB learning. Analyzes file importance, auto-detects highest unprocessed tier, drains pending tier-by-tier, relinks graph, sets up file monitors. No manual tier passing. Just call /vicky:learn — it finds the next tier and keeps going.',
		inputSchema: {
			count: z.number().optional().describe('Max pending notes to drain per tier (default: 20)'),
		},
	}, async ({ count }) => {
		await ensure_init();
		const n = count && count > 0 ? count : 20;

		const existing = jobs.reject_if_running('learn');
		if (existing) {
			return { content: [{ type: 'text', text: JSON.stringify({ status: 'queued', job_id: existing, est_seconds: est_learn_seconds() }) }] };
		}

		const job_id = jobs.create('learn');

		(async () => {
			try {
				// Phase 1: Analyze file importance + auto-detect next tier
				jobs.update(job_id, { progress: { phase: 'analyze' } });
				notify('info', 'vicky: analyzing file importance (AST + git history)...');
				let importance = null;
				let tierState = get_tier_state();
				let currentTier = tierState.current_tier;

				try {
					// Get coverage to find next unprocessed tier
					const { coverageReport } = await import('../graph-importance.js');
					const coverage = await coverageReport(100);
					if (coverage.ok) {
						const nextTier = get_next_tier(coverage);
						currentTier = nextTier;
						notify('info', `vicky: tier ${currentTier}: ${coverage.tiers[currentTier]?.coverage || 0}% indexed.`);
					}

					// Analyze files in current tier
					importance = await analyzeFileImportance(50, currentTier);
					if (importance.ok) {
						notify('info', `vicky: tier ${currentTier}: identified ${importance.top_files.length} files to source.`);
					}
				} catch (e) {
					notify('info', `vicky: analysis skipped (${e.message}). Using pending queue.`);
				}

				// Phase 2: Drain pending queue (prioritize current tier)
				const wf = load_workflow();
				const triage = wf.default_workflow === 'triage';
				const prio_rank = p => (p === 'high' ? 0 : p === 'med' ? 1 : 2);
				let allPending = list_pending()
					.map(pf => ({ pf, info: (() => { try { return read_pending(pf); } catch { return {}; } })() }))
					.map(x => ({ ...x, prio: (x.info && x.info.priority) || 'med' }));
				if (triage) allPending = allPending.filter(x => x.prio === 'high');
				allPending.sort((a, b) => prio_rank(a.prio) - prio_rank(b.prio));

				// Prioritize pending notes linked to current tier
				const tierFiles = importance?.ok ? importance.top_files : [];
				const tierSet = new Set(tierFiles.map(f => f.split('/').pop().toLowerCase()));
				const [tieredPending, otherPending] = allPending.reduce((acc, x) => {
					const slug = x.pf.toLowerCase().replace(/[^a-z0-9]/g, '');
					const matches = [...tierSet].some(f => slug.includes(f.split('.')[0]) || f.includes(slug.split('-')[0]));
					acc[matches ? 0 : 1].push(x);
					return acc;
				}, [[], []]);

				const pending = [...tieredPending, ...otherPending].slice(0, n).map(x => x.pf);

				jobs.update(job_id, { progress: { phase: 'drain', total: pending.length } });

				let promoted = 0;
				let patched = 0;
				for (const pf of pending) {
					try {
						const { question, context, sources: pending_sources } = read_pending(pf);

						const ctx = await query_graph(question, fs.kb_graph(), 'sources');
						const source_body = [
							`## Question\n${question}`,
							context ? `## Context\n${context}` : '',
							ctx ? `## Graph Context\n\`\`\`\n${ctx.trim()}\n\`\`\`` : '',
						].filter(Boolean).join('\n\n');
						const newSrcPath = save_note(question, source_body, {
							dir: fs.sources(),
							tags: ['source'],
							type: 'source',
							related: pending_sources,
							filename_slug: slugify(pf),
						});
						autofill_frontmatter(newSrcPath);

						delete_pending(pf);
						promoted++;
					} catch (e) {
						notify('error', `vicky: drain error on ${pf}: ${e.message.split('\n')[0]}`);
					}
				}
				if (promoted) notify('info', `vicky: promoted ${promoted} pending → source.`);
				if (patched) notify('info', `vicky: backfilled frontmatter on ${patched} existing sources.`);

				jobs.update(job_id, { progress: { phase: 'relink', tier: currentTier }, counts: { promoted, patched } });

				notify('info', 'vicky: rebuilding semantic graph...');
					const upd = await update_kb();
					if (upd && upd.ok === false) {
						const hint = upd.reason === 'no_backend'
							? 'set GEMINI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY)'
							: upd.reason === 'graphify_missing'
								? 'run `npm install` in vicky plugin root'
								: 'corpus may be too small';
						notify('info', `vicky learn: graph not rebuilt (${upd.reason}) — ${hint}. Relinking against stale graph.`);
					}
					notify('info', 'vicky: relinking...');
				const graph = fs.kb_graph();
				const [src, con] = await Promise.all([
					relink_dir(fs.sources(), graph),
					relink_dir(fs.conclusions(), graph),
				]);
				notify('info', `vicky done: tier ${currentTier}: ${src.patched + con.patched} relinked.`);

				// Phase 4: Set up file monitors for auto-reactions
				if (promoted > 0 || src.patched > 0 || con.patched > 0) {
					notify('info', 'vicky: setting up file monitors for auto-reactions...');
					const monitorsSetup = [
						'/monitor create vicky/.graphify/graph.json --on change --run "/vicky:relink"',
						'/monitor create vicky/.graphify/.graphify_ast.json --on change --run "/vicky:learn"',
						'/monitor create vicky/pending/ --on new-file --run "/vicky:learn"',
						'/monitor create vicky/sources/ --on change --run "/vicky:relink"'
					];
					for (const cmd of monitorsSetup) {
						notify('monitor-setup', cmd);
					}
				}

				// Update tier state
				tierState.current_tier = currentTier;
				save_tier_state(tierState);

				jobs.update(job_id, {
					status: 'done',
					counts: { promoted, patched, relinked: src.patched + con.patched, sources_relinked: src.patched, conclusions_relinked: con.patched },
					tier: currentTier,
				});
			} catch (e) {
				jobs.update(job_id, { status: 'failed', error: e.message });
				notify('error', `vicky learn failed: ${e.message}`);
			}
		})();

		return { content: [{ type: 'text', text: JSON.stringify({ status: 'queued', job_id, est_seconds: est_learn_seconds() }) }] };
	});
}