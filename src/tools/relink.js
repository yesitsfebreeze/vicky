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
				await update_kb();
				notify('info', 'vicky relink: querying graph for all files...');
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
