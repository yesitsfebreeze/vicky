import { z } from 'zod';
import { join } from 'path';
import * as fs from '../fs.js';
import { save_note } from '../vault.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('conclude', {
		description: 'Save a derived conclusion into vicky/conclusions/. Use after a research pass when you have a synthesized takeaway backed by one or more sources. The sources arg is written as [[wikilinks]] in both frontmatter and the body so the conclusion is graph-connected to its evidence.',
		inputSchema: {
			title:   z.string().describe('Conclusion title'),
			content: z.string().describe('Synthesised takeaway (markdown)'),
			folder:  z.string().optional().describe('Subfolder inside vicky/conclusions (e.g. "perf", "physics")'),
			tags:    z.array(z.string()).optional().describe('Extra tags merged with `conclusion`'),
			sources: z.array(z.string()).optional().describe('Source IDs (hash filenames from remember/learn responses) this conclusion derives from. Pass at least one. Written as [[wikilinks]] in frontmatter + body.'),
			related: z.array(z.string()).optional().describe('Sibling conclusions or related notes'),
		},
	}, async ({ title, content, folder, tags = [], sources = [], related = [] }) => {
		await ensure_init();
		const dir = folder ? join(fs.conclusions(), folder) : fs.conclusions();
		const merged = Array.from(new Set(['conclusion', ...tags.filter(t => t !== 'research' && t !== 'pending')]));
		const path = save_note(title, content, { dir, tags: merged, type: 'conclusion', sources, related });
		return { content: [{ type: 'text', text: `Saved: ${path}` }] };
	});
}
