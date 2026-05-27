import { z } from 'zod';
import * as fs from '../fs.js';
import { query_graph_hits } from '../graph.js';
import { search_hits, enqueue_research, list_pending } from '../vault.js';
import { ensure_init } from '../init.js';
import { should_auto_enqueue, get_workflow_for } from '../workflow.js';
import { slugify, match_prefix } from '../slug.js';

const TOP_K = 10;

function merge_hits(graph_hits, vault_hits, limit) {
	const by_path = new Map();
	for (const h of graph_hits) {
		by_path.set(h.note_path, { ...h, score: +(h.score + 0.05).toFixed(4) });
	}
	for (const h of vault_hits) {
		const ex = by_path.get(h.note_path);
		if (ex) {
			ex.score = +Math.max(ex.score, h.score).toFixed(4);
			if (!ex.snippet && h.snippet) ex.snippet = h.snippet;
		} else {
			by_path.set(h.note_path, h);
		}
	}
	return [...by_path.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

function human_summary(question, hits, gap, enqueued) {
	if (gap && enqueued) return `gap on "${question}" — auto-enqueued`;
	if (gap) return `gap on "${question}" — no auto-enqueue`;
	const top = hits[0];
	const name = top.note_path.split('/').pop().replace(/\.md$/, '');
	return `${hits.length} hits, top: ${name} (score ${top.score}, ${top.inlinks} inlinks)`;
}

export function register(server, notify) {
	server.registerTool('research-gap', {
		description: 'Query KB. If gap found, auto-enqueue web research. Returns scored hits + status as JSON.',
		inputSchema: {
			question: z.string().describe('Question to answer'),
			auto_research: z.boolean().optional().describe('Auto-enqueue web research if gap (default: true)'),
		},
	}, async ({ question, auto_research = true }) => {
		await ensure_init();

		const graph = fs.kb_graph();
		const [g_con, g_src] = await Promise.all([
			query_graph_hits(question, 'conclusions', graph, TOP_K),
			query_graph_hits(question, 'sources', graph, TOP_K),
		]);
		const graph_hits = [...g_con, ...g_src];

		const v_con = search_hits(fs.conclusions(), question, TOP_K);
		const v_src = search_hits(fs.sources(), question, TOP_K);
		const vault_hits = [...v_con, ...v_src];

		const hits = merge_hits(graph_hits, vault_hits, TOP_K);
		const gap = hits.length === 0;
		const workflow = get_workflow_for(question);

		let enqueued = false;
		let already_pending = false;
		if (gap) {
			const should = auto_research && should_auto_enqueue();
			if (should) {
				const pending = list_pending();
				const q_slug = slugify(question);
				already_pending = pending.some(f => match_prefix(q_slug, f));
				if (!already_pending) {
					enqueue_research(question, { requested_by: workflow });
					notify('info', `vicky: auto-enqueued research for "${question}" (workflow: ${workflow})`);
					enqueued = true;
				}
			}
		}

		const payload = {
			_human: human_summary(question, hits, gap, enqueued || already_pending),
			question,
			workflow,
			gap,
			hits,
			enqueued,
			already_pending,
		};
		return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
	});
}
