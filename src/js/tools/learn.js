import { z } from 'zod';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import * as fs from '../fs.js';
import { query_graph } from '../graph.js';
import { relink_dir } from '../link.js';
import { save_note, list_pending, read_pending, delete_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { load_workflow } from '../workflow.js';
import * as jobs from '../jobs.js';

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

export function register(server, notify) {
	server.registerTool('learn', {
		description: 'Walk the KB: drain pending queue → promote to sources → relink. No external fetches and no stub conclusions — synthesis lands in conclusions/ only via `conclude` or `complete-research` once real takeaways exist. /vicky:research fetches new data and calls this tool afterwards to absorb it.',
		inputSchema: {
			count: z.number().optional().describe('Max pending notes to drain (default: 20)'),
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
				const wf = load_workflow();
				const triage = wf.default_workflow === 'triage';
				const prio_rank = p => (p === 'high' ? 0 : p === 'med' ? 1 : 2);
				let pending = list_pending()
					.map(pf => ({ pf, info: (() => { try { return read_pending(pf); } catch { return {}; } })() }))
					.map(x => ({ ...x, prio: (x.info && x.info.priority) || 'med' }));
				if (triage) pending = pending.filter(x => x.prio === 'high');
				pending.sort((a, b) => prio_rank(a.prio) - prio_rank(b.prio));
				pending = pending.slice(0, n).map(x => x.pf);

				jobs.update(job_id, { progress: { phase: 'drain', total: pending.length } });

				let promoted = 0;
				let patched = 0;
				for (const pf of pending) {
					try {
						const slug = pf.replace(/\.md$/, '');
						const srcPath = join(fs.sources(), pf);
						if (existsSync(srcPath)) {
							if (autofill_frontmatter(srcPath)) patched++;
							delete_pending(pf);
							continue;
						}
						const { question, context, sources: pending_sources } = read_pending(pf);

						const ctx = await query_graph(question, fs.kb_graph(), 'sources');
						const source_body = [
							`## Question\n${question}`,
							context ? `## Context\n${context}` : '',
							ctx ? `## Graph Context\n\`\`\`\n${ctx.trim()}\n\`\`\`` : '',
						].filter(Boolean).join('\n\n');
						save_note(slug, source_body, {
							dir: fs.sources(),
							tags: ['source'],
							type: 'source',
							related: pending_sources,
						});
						autofill_frontmatter(join(fs.sources(), `${slug}.md`));

						delete_pending(pf);
						promoted++;
					} catch (e) {
						notify('error', `vicky: drain error on ${pf}: ${e.message.split('\n')[0]}`);
					}
				}
				if (promoted) notify('info', `vicky: promoted ${promoted} pending → source.`);
				if (patched) notify('info', `vicky: backfilled frontmatter on ${patched} existing sources.`);

				jobs.update(job_id, { progress: { phase: 'relink' }, counts: { promoted, patched } });

				notify('info', 'vicky: relinking...');
				const graph = fs.kb_graph();
				const [src, con] = await Promise.all([
					relink_dir(fs.sources(), graph),
					relink_dir(fs.conclusions(), graph),
				]);
				notify('info', `vicky done: ${src.patched + con.patched} relinked.`);

				jobs.update(job_id, {
					status: 'done',
					counts: { promoted, patched, relinked: src.patched + con.patched, sources_relinked: src.patched, conclusions_relinked: con.patched },
				});
			} catch (e) {
				jobs.update(job_id, { status: 'failed', error: e.message });
				notify('error', `vicky learn failed: ${e.message}`);
			}
		})();

		return { content: [{ type: 'text', text: JSON.stringify({ status: 'queued', job_id, est_seconds: est_learn_seconds() }) }] };
	});
}