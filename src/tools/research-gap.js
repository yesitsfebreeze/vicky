import { z } from 'zod';
import * as fs from '../fs.js';
import { query_graph } from '../graph.js';
import { search, enqueue_research, list_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { should_auto_enqueue, get_workflow_for, bias_by_focus } from '../workflow.js';

export function register(server, notify) {
	server.registerTool('research-gap', {
		description: 'Query KB. If gap found, auto-enqueue web research. Returns context + status.',
		inputSchema: {
			question: z.string().describe('Question to answer'),
			auto_research: z.boolean().optional().describe('Auto-enqueue web research if gap (default: true)'),
		},
	}, async ({ question, auto_research = true }) => {
		await ensure_init();

		// Query the unified KB graph; split source-/conclusion-scoped views.
		const graph = fs.kb_graph();
		const [con, src] = await Promise.all([
			query_graph(question, graph, 'conclusions'),
			query_graph(question, graph, 'sources'),
		]);
		let parts = [con, src].filter(Boolean);

		// Fallback to vault text search if graph query empty
		if (!parts.length) {
			const vault_con = search(fs.conclusions(), question);
			const vault_src = search(fs.sources(), question);
			parts = [vault_con, vault_src].filter(Boolean);
		}

		const workflow = get_workflow_for(question);

		// Found answer - return it (biased by active_focus)
		if (parts.length) {
			const body = bias_by_focus(parts.join('\n\n')).slice(0, 4000);
			return {
				content: [{
					type: 'text',
					text: `✓ Knowledge found.\n\nQuestion: ${question}\nWorkflow: ${workflow}\n\nContext:\n${body}`
				}]
			};
		}

		// Honor WORKFLOW.md `auto_enqueue` unless caller explicitly overrides
		const should = auto_research && should_auto_enqueue();

		// Gap found - auto-enqueue web research if enabled
		if (should) {
			const pending = list_pending();
			const alreadyEnqueued = pending.some(f =>
				f.toLowerCase().includes(question.slice(0, 20).toLowerCase().replace(/[^\w]/g, ''))
			);

			if (!alreadyEnqueued) {
				enqueue_research(question, { requested_by: workflow });
				notify('info', `vicky: auto-enqueued research for "${question}" (workflow: ${workflow})`);

				return {
					content: [{
						type: 'text',
						text: `✗ Knowledge gap: "${question}"\n\nWorkflow: ${workflow}\nAuto-enqueued for research. Run /vic:research to process.`
					}]
				};
			} else {
				return {
					content: [{
						type: 'text',
						text: `✗ Knowledge gap: "${question}"\n\nAlready enqueued for research. Run /vic:research to process.`
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
