import { z } from 'zod';
import * as fs from '../fs.js';
import { query_graph } from '../graph.js';
import { search } from '../vault.js';
import { ensure_init } from '../init.js';
import { bias_by_focus, get_workflow_for } from '../workflow.js';

export function register(server) {
	server.registerTool('query', {
		description: 'Query KB for question. Returns context if found + gap signal if not. Use vic:web-search if gap detected.',
		inputSchema: { question: z.string().describe('Question to answer') },
	}, async ({ question }) => {
		await ensure_init();
		const graph = fs.kb_graph();
		const [con, src] = await Promise.all([
			query_graph(question, graph, 'conclusions'),
			query_graph(question, graph, 'sources'),
		]);
		let parts = [con, src].filter(Boolean);

		if (!parts.length) {
			const vault_con = search(fs.conclusions(), question);
			const vault_src = search(fs.sources(), question);
			parts = [vault_con, vault_src].filter(Boolean);
		}

		if (!parts.length) {
			return {
				content: [{
					type: 'text',
					text: `KNOWLEDGE GAP: "${question}"\n\nNo conclusions or sources found. Use /vic:web-search to research and save findings as sources.`
				}],
				isError: false
			};
		}

		const body = bias_by_focus(parts.join('\n\n')).slice(0, 4000);
		const wf = get_workflow_for(question);
		return { content: [{ type: 'text', text: `Question: ${question}\nWorkflow: ${wf}\n\nKnowledge:\n${body}` }] };
	});
}
