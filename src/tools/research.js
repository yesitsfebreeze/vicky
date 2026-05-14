import { z } from 'zod';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { SRC, CON, SRC_GRAPH, CON_GRAPH } from '../conf.js';
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
				// ⓪ Drain pending research queue → conclusion stubs
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
					let drained = 0;
					for (const pf of pending) {
						try {
							const conPath = join(CON, pf);
							if (existsSync(conPath)) { delete_pending(pf); continue; }
							const { question, context } = read_pending(pf);
							const ctx = await query_graph(question, SRC_GRAPH);
							const body = [
								context ? `## Requested Context\n${context}` : '',
								ctx ? `## Graph Context\n\`\`\`\n${ctx.trim()}\n\`\`\`` : '',
							].filter(Boolean).join('\n\n') || '_pending research_';
							save_note(question, body, { dir: CON, tags: ['conclusion', 'from-queue'], type: 'conclusion' });
							delete_pending(pf);
							drained++;
						} catch (e) {
							notify('error', `vicky: drain error on ${pf}: ${e.message.split('\n')[0]}`);
						}
					}
					if (drained) notify('info', `vicky: drained ${drained} pending → conclusion stubs.`);
				}

				// ① Discover new topics → create conclusion stubs
				if (!topic) {
					const conTitles = list_con_files().map(f => f.replace(/\.md$/, ''));
					const norm = s => s.toLowerCase().replace(/[^\w]/g, '');
					const conNorms = conTitles.map(norm);
					const newTopics = list_titles_from_graph(SRC_GRAPH)
						.filter(t => t.length > 10)
						.filter(t => {
							const n = norm(t).slice(0, 30);
							return !conNorms.some(h => h.startsWith(n.slice(0, 15)) || n.startsWith(h.slice(0, 15)));
						})
						.sort(() => Math.random() - 0.5)
						.slice(0, Math.floor(n / 2));
					for (const t of newTopics) {
						const ctx = await query_graph(t, SRC_GRAPH);
						const body = ctx ? `## Graph Context\n\`\`\`\n${ctx.trim()}\n\`\`\`` : '_No graph context yet._';
						save_note(t, body, { dir: CON, tags: ['conclusion'], type: 'conclusion' });
					}
					if (newTopics.length) notify('info', `vicky: created ${newTopics.length} new conclusion stubs.`);
				}

				// ② Handle explicit topic-based research
				if (topic) {
					const safe = topic.replace(/[^\w\s-]/g, '').trim().slice(0, 60);
					const conPath = join(CON, `${safe}.md`);
					if (!existsSync(conPath)) {
						save_note(safe, '_stub_', { dir: CON, tags: ['conclusion'], type: 'conclusion' });
						notify('info', `vicky: created conclusion stub for "${safe}"`);
					}
				}

				// ③ Relink (updates graphs + writes related: frontmatter)
				notify('info', 'vicky: relinking...');
				const [src, con] = await Promise.all([
					relink_dir(SRC, SRC_GRAPH),
					relink_dir(CON, CON_GRAPH),
				]);
				notify('info', `vicky done: ${src.patched + con.patched} relinked.`);
			} catch (e) {
				notify('error', `vicky learn failed: ${e.message}`);
			}
		})();

		return { content: [{ type: 'text', text: `Researching ${topic ? `"${topic}"` : `up to ${n} conclusions`} in background.` }] };
	});
}
