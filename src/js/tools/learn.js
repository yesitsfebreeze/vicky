import { z } from 'zod';
import { join } from 'path';
import { existsSync } from 'fs';
import * as fs from '../fs.js';
import { query_graph } from '../graph.js';
import { relink_dir } from '../link.js';
import { save_note, list_pending, read_pending, delete_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { load_workflow } from '../workflow.js';

export function register(server, notify) {
	server.registerTool('learn', {
		description: 'Walk the KB: drain pending queue → promote to sources → relink. No external fetches and no stub conclusions — synthesis lands in conclusions/ only via `conclude` or `complete-research` once real takeaways exist. /vicky:research fetches new data and calls this tool afterwards to absorb it.',
		inputSchema: {
			count: z.number().optional().describe('Max pending notes to drain (default: 20)'),
		},
	}, async ({ count }) => {
		await ensure_init();
		const n = count && count > 0 ? count : 20;

		(async () => {
			try {
				// Drain pending → source. Conclusions are intentionally NOT created
				// here: a conclusion file only exists when there is real synthesis,
				// produced by `conclude` or `complete-research`. Idempotent — if a
				// source already exists for the slug, the pending file is dropped
				// without overwrite.
				const wf = load_workflow();
				const triage = wf.default_workflow === 'triage';
				const prio_rank = p => (p === 'high' ? 0 : p === 'med' ? 1 : 2);
				let pending = list_pending()
					.map(pf => ({ pf, info: (() => { try { return read_pending(pf); } catch { return {}; } })() }))
					.map(x => ({ ...x, prio: (x.info && x.info.priority) || 'med' }));
				if (triage) pending = pending.filter(x => x.prio === 'high');
				pending.sort((a, b) => prio_rank(a.prio) - prio_rank(b.prio));
				pending = pending.slice(0, n).map(x => x.pf);
				let promoted = 0;
				for (const pf of pending) {
					try {
						const slug = pf.replace(/\.md$/, '');
						const srcPath = join(fs.sources(), pf);
						if (existsSync(srcPath)) { delete_pending(pf); continue; }
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

						delete_pending(pf);
						promoted++;
					} catch (e) {
						notify('error', `vicky: drain error on ${pf}: ${e.message.split('\n')[0]}`);
					}
				}
				if (promoted) notify('info', `vicky: promoted ${promoted} pending → source.`);

				notify('info', 'vicky: relinking...');
				const graph = fs.kb_graph();
				const [src, con] = await Promise.all([
					relink_dir(fs.sources(), graph),
					relink_dir(fs.conclusions(), graph),
				]);
				notify('info', `vicky done: ${src.patched + con.patched} relinked.`);
			} catch (e) {
				notify('error', `vicky learn failed: ${e.message}`);
			}
		})();

		return { content: [{ type: 'text', text: `Learning up to ${n} pending notes in background.` }] };
	});
}
