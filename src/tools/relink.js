import * as fs from '../fs.js';
import { update_kb } from '../graph.js';
import { relink_dir } from '../link.js';
import { ensure_init } from '../init.js';

export function register(server, notify) {
	server.registerTool('relink', {
		description: 'Rebuild related: frontmatter for all files from the unified KB graph. Runs independently of a research pass.',
		inputSchema: {},
	}, async () => {
		await ensure_init();
		(async () => {
			try {
				notify('info', 'vicky relink: updating KB graph...');
				const upd = await update_kb();
				if (upd && upd.ok === false) {
					const hint = upd.reason === 'no_backend'
						? 'set GEMINI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) and retry'
						: upd.reason === 'graphify_missing'
							? 'run `npm install` in the vicky plugin root'
							: 'corpus may be too small for a graph';
					notify('info', `vicky relink: graph not produced (${upd.reason}) — ${hint}.`);
					return;
				}
				notify('info', `vicky relink: graph built via ${upd?.backend ?? 'graphify'}; querying for related links...`);
				const graph = fs.kb_graph();
				const [src, con] = await Promise.all([
					relink_dir(fs.sources(), graph),
					relink_dir(fs.conclusions(), graph),
				]);
				notify('info', `vicky relink done: ${src.patched + con.patched} relinked (${src.patched}/${src.total} sources, ${con.patched}/${con.total} conclusions).`);
			} catch (e) {
				notify('error', `vicky relink failed: ${e.message}`);
			}
		})();
		return { content: [{ type: 'text', text: 'Relinking all conclusions in background.' }] };
	});
}
