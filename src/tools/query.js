import { z } from 'zod';
import { SRC_GRAPH, CON_GRAPH } from '../conf.js';
import { query_graph } from '../graph.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('query', {
		description: 'Query KB for question. Returns context if found + gap signal if not. Use vic:web-search if gap detected.',
		inputSchema: { question: z.string().describe('Question to answer') },
	}, async ({ question }) => {
		await ensure_init();
		const [con, src] = await Promise.all([
			query_graph(question, CON_GRAPH),
			query_graph(question, SRC_GRAPH),
		]);
		const parts = [con, src].filter(Boolean);

		if (!parts.length) {
			return {
				content: [{
					type: 'text',
					text: `KNOWLEDGE GAP: "${question}"\n\nNo conclusions or sources found. Use /vic:web-search to research and save findings as sources.`
				}],
				isError: false
			};
		}

		return { content: [{ type: 'text', text: `Question: ${question}\n\nKnowledge:\n${parts.join('\n\n').slice(0, 4000)}` }] };
	});
}
