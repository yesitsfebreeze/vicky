import { z } from 'zod';
import { save_note } from '../vault.js';
import { ensure_init } from '../init.js';

export function register(server, notify) {
	server.registerTool('web-search', {
		description: 'Web search for a question, save findings as source files. Results feed into next research pass.',
		inputSchema: {
			question: z.string().describe('Question to research'),
			context: z.string().optional().describe('Why this is important / what problem to solve'),
		},
	}, async ({ question, context }) => {
		await ensure_init();

		// Placeholder: would call actual web search API (Google, DuckDuckGo, etc.)
		// For now, returns stub indicating this should be researched
		const timestamp = new Date().toISOString().split('T')[0];
		const summary = `**Question:** ${question}\n\n${context ? `**Context:** ${context}\n\n` : ''}**Status:** Pending web research\n**Date:** ${timestamp}`;

		const path = save_note(`web-research-${question}`, summary, {
			dir: undefined, // Uses SRC by default
			tags: ['web-research', 'pending'],
			type: 'web-research'
		});

		const msg = `Enqueued web research: "${question}"\nPath: ${path}\n\nNote: Claude will fill in findings after web search.`;
		notify('info', msg);

		return { content: [{ type: 'text', text: msg }] };
	});
}
