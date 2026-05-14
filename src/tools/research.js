import { z } from 'zod';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as fs from '../fs.js';
import { query_graph, list_titles_from_graph } from '../graph.js';
import { relink_dir } from '../link.js';
import { save_note, list_con_files, list_pending, read_pending, delete_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { load_workflow } from '../workflow.js';

export function register(server, notify) {
	server.registerTool('research', {
		description: 'Autonomous pass: drain pending queue → discover new topics → relink',
		inputSchema: {
			topic: z.string().optional().describe('Specific topic to research'),
			count: z.number().optional().describe('Max conclusions to process (default: 20)'),
			force: z.boolean().optional().describe('Re-enrich conclusions that already have ## Research'),
		},
	}, async ({ topic, count, force = false }) => {
		await ensure_init();
		const n = count && count > 0 ? count : 20;

		(async () => {
			try {
				// ⓪ Drain pending: promote to source, then create derived conclusion.
				// Contract: every pending note ends up as exactly one source + one
				// conclusion linked via [[wikilinks]]. Idempotent — if a conclusion
				// already exists for a pending filename, the pending file is dropped.
				if (!topic) {
					const wf = load_workflow();
					const triage = wf.default_workflow === 'triage';
					const prio_rank = p => (p === 'high' ? 0 : p === 'med' ? 1 : 2);
					let pending = list_pending()
						.map(pf => ({ pf, info: (() => { try { return read_pending(pf); } catch { return {}; } })() }))
						.map(x => ({ ...x, prio: (x.info && x.info.priority) || 'med' }));
					if (triage) pending = pending.filter(x => x.prio === 'high');
					pending.sort((a, b) => prio_rank(a.prio) - prio_rank(b.prio));
					pending = pending.map(x => x.pf);
					let promoted = 0;
					for (const pf of pending) {
						try {
							const slug = pf.replace(/\.md$/, '');
							const conPath = join(fs.conclusions(), pf);
							if (existsSync(conPath)) { delete_pending(pf); continue; }
							const { question, context, sources: pending_sources, path: pending_path } = read_pending(pf);

							// 1. Promote pending → source. Body preserves question + context.
							const ctx = await query_graph(question, fs.sources_graph());
							const ctx_titles = ctx ? [...ctx.matchAll(/^NODE\s+(.+?)\.md\s+\[/gm)].map(m => m[1].trim()) : [];
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

							// 2. Derive conclusion linked to the new source + any prior sources.
							const linked = [...new Set([slug, ...pending_sources, ...ctx_titles])];
							save_note(slug, '_derived from pending — fill in synthesis_', {
								dir: fs.conclusions(),
								tags: ['conclusion'],
								type: 'conclusion',
								sources: linked,
							});

							// 3. Drop the pending stub.
							delete_pending(pf);
							promoted++;
						} catch (e) {
							notify('error', `vicky: drain error on ${pf}: ${e.message.split('\n')[0]}`);
						}
					}
					if (promoted) notify('info', `vicky: promoted ${promoted} pending → source + conclusion.`);
				}

				// ① Discover new topics → create conclusion stubs
				if (!topic) {
					const conTitles = list_con_files().map(f => f.replace(/\.md$/, ''));
					const norm = s => s.toLowerCase().replace(/[^\w]/g, '');
					const conNorms = conTitles.map(norm);
					const newTopics = list_titles_from_graph(fs.sources_graph())
						.filter(t => t.length > 10)
						.filter(t => {
							const n = norm(t).slice(0, 30);
							return !conNorms.some(h => h.startsWith(n.slice(0, 15)) || n.startsWith(h.slice(0, 15)));
						})
						.sort(() => Math.random() - 0.5)
						.slice(0, Math.floor(n / 2));
					for (const t of newTopics) {
						const ctx = await query_graph(t, fs.sources_graph());
						const body = ctx ? `## Graph Context\n\`\`\`\n${ctx.trim()}\n\`\`\`` : '_No graph context yet._';
						save_note(t, body, { dir: fs.conclusions(), tags: ['conclusion'], type: 'conclusion' });
					}
					if (newTopics.length) notify('info', `vicky: created ${newTopics.length} new conclusion stubs.`);
				}

				// ② Handle explicit topic-based research
				if (topic) {
					const safe = topic.replace(/[^\w\s-]/g, '').trim().slice(0, 60);
					const conPath = join(fs.conclusions(), `${safe}.md`);
					if (!existsSync(conPath)) {
						save_note(safe, '_stub_', { dir: fs.conclusions(), tags: ['conclusion'], type: 'conclusion' });
						notify('info', `vicky: created conclusion stub for "${safe}"`);
					}
				}

				// ③ Relink (updates graphs + writes related: frontmatter)
				notify('info', 'vicky: relinking...');
				const [src, con] = await Promise.all([
					relink_dir(fs.sources(), fs.sources_graph()),
					relink_dir(fs.conclusions(), fs.conclusions_graph()),
				]);
				notify('info', `vicky done: ${src.patched + con.patched} relinked.`);
			} catch (e) {
				notify('error', `vicky learn failed: ${e.message}`);
			}
		})();

		return { content: [{ type: 'text', text: `Researching ${topic ? `"${topic}"` : `up to ${n} conclusions`} in background.` }] };
	});
}
