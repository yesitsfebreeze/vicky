import { z } from 'zod';
import { join } from 'path';
import { existsSync } from 'fs';
import * as fs from '../fs.js';
import { save_note, conclusion_scaffold } from '../vault.js';
import { ensure_init } from '../init.js';

const safe_name = t => t.replace(/[^\w\s-]/g, '').trim().slice(0, 60).replace(/\s+/g, '-');

export function register(server) {
	server.registerTool('remember', {
		description: 'Save key points or findings into the source vault. Also seeds a paired conclusion stub in .vicky/conclusions/ if one does not already exist — sources spawn conclusions by design.',
		inputSchema: {
			title:   z.string().describe('Topic title'),
			content: z.string().describe('Key points or findings (markdown)'),
			folder:  z.string().optional().describe('Subfolder inside .vicky/sources (e.g. "nanite", "physics")'),
			tags:    z.array(z.string()).optional().describe('Tags'),
			sources: z.array(z.string()).optional().describe('Upstream sources this note derives from — written as [[wikilinks]] in body + sources: frontmatter'),
			related: z.array(z.string()).optional().describe('Sibling notes — written as [[wikilinks]] in body + related: frontmatter'),
		},
	}, async ({ title, content, folder, tags = [], sources = [], related = [] }) => {
		await ensure_init();
		if (folder && /^(conclusion|conclusions)$/i.test(folder.trim())) {
			return { content: [{ type: 'text', text: 'remember writes to .vicky/sources/ only. To save a derived conclusion, call `conclude` instead.' }], isError: true };
		}
		const dir = folder ? join(fs.sources(), folder) : fs.sources();
		const merged = Array.from(new Set(['source', ...tags.filter(t => t !== 'research')]));
		const path = save_note(title, content, { dir, tags: merged, type: 'source', sources, related });

		// Auto-spawn paired conclusion stub. Source → conclusion is the canonical
		// KB shape; every `remember` call seeds the matching conclusion so the
		// synthesis lives somewhere instead of floating in source bodies.
		const slug = safe_name(title);
		const con_path = join(fs.conclusions(), `${slug}.md`);
		let con_msg = '';
		if (!existsSync(con_path)) {
			save_note(slug, conclusion_scaffold(title), {
				dir: fs.conclusions(),
				tags: ['conclusion'],
				type: 'conclusion',
				sources: [slug, ...sources],
				related,
			});
			con_msg = `\nConclusion stub seeded: ${con_path}`;
		}
		return { content: [{ type: 'text', text: `Saved: ${path}${con_msg}` }] };
	});
}
