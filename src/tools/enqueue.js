import { z } from 'zod';
import { enqueue_research, list_pending } from '../vault.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('enqueue', {
		description: 'Queue a research question for the next /vic:research pass. Non-blocking — writes a pending stub that the next research pass will drain into a conclusion and enrich.',
		inputSchema: {
			question: z.string().describe('The research question to investigate later'),
			context: z.string().optional().describe('Why this is needed / surrounding context'),
			requested_by: z.string().optional().describe('File, task, or topic that triggered the request'),
			priority: z.enum(['low', 'med', 'high']).optional().describe('Default: med'),
		},
	}, async ({ question, context, requested_by, priority }) => {
		await ensure_init();
		const path = enqueue_research(question, { context, requested_by, priority });
		const depth = list_pending().length;
		return { content: [{ type: 'text', text: `Queued: ${path}\nPending queue depth: ${depth}` }] };
	});
}
