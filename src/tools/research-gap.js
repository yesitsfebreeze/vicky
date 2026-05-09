import { z } from 'zod';
import { SRC_GRAPH, CON_GRAPH, SRC } from '../conf.js';
import { query_graph } from '../graph.js';
import { save_note, list_pending } from '../vault.js';
import { ensure_init } from '../init.js';

export function register(server, notify) {
	server.registerTool('research-gap', {
		description: 'Query KB. If gap found, auto-enqueue web research. Returns context + status.',
		inputSchema: {
			question: z.string().describe('Question to answer'),
			auto_research: z.boolean().optional().describe('Auto-enqueue web research if gap (default: true)'),
		},
	}, async ({ question, auto_research = true }) => {
		await ensure_init();

		// Query KB
		const [con, src] = await Promise.all([
			query_graph(question, CON_GRAPH),
			query_graph(question, SRC_GRAPH),
		]);
		const parts = [con, src].filter(Boolean);

		// Found answer - return it
		if (parts.length) {
			return {
				content: [{
					type: 'text',
					text: `✓ Knowledge found.\n\nQuestion: ${question}\n\nContext:\n${parts.join('\n\n').slice(0, 4000)}`
				}]
			};
		}

		// Gap found - auto-enqueue web research if enabled
		if (auto_research) {
			const pending = list_pending();
			const alreadyEnqueued = pending.some(f =>
				f.toLowerCase().includes(question.slice(0, 20).toLowerCase().replace(/[^\w]/g, ''))
			);

			if (!alreadyEnqueued) {
				const timestamp = new Date().toISOString().split('T')[0];
				const summary = `**Question:** ${question}\n\n**Status:** Auto-enqueued for web research\n**Date:** ${timestamp}`;
				save_note(`web-research-${question}`, summary, {
					dir: SRC,
					tags: ['web-research', 'auto-enqueued'],
					type: 'web-research'
				});
				notify('info', `vicky: auto-enqueued web research for "${question}"`);

				return {
					content: [{
						type: 'text',
						text: `✗ Knowledge gap: "${question}"\n\nAuto-enqueued for web research. Run /vic:research next to fill gap.`
					}]
				};
			} else {
				return {
					content: [{
						type: 'text',
						text: `✗ Knowledge gap: "${question}"\n\nAlready enqueued for web research. Run /vic:research to process.`
					}]
				};
			}
		}

		// Gap found, no auto-research
		return {
			content: [{
				type: 'text',
				text: `✗ Knowledge gap: "${question}"\n\nNo KB match. Use /vic:web-search "question" to research manually.`
			}]
		};
	});
}
