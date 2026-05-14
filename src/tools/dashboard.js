import { z } from 'zod';
import { build_dashboard } from '../dashboard.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('dashboard', {
		description: 'Render KB dashboard (counts, hubs, pending, orphans, stale, tags) via Obsidian + Dataview. Requires .vicky vault open in Obsidian with Dataview plugin enabled. For ad-hoc queries use the `dql` tool.',
		inputSchema: {
			format: z.enum(['markdown', 'json']).optional().describe('Output format (default: markdown)'),
		},
	}, async ({ format = 'markdown' }) => {
		await ensure_init();
		try {
			const { data, markdown } = build_dashboard();
			return { content: [{ type: 'text', text: format === 'json' ? JSON.stringify(data, null, 2) : markdown }] };
		} catch (e) {
			return { content: [{ type: 'text', text: `dashboard error: ${e.message}` }], isError: true };
		}
	});
}
