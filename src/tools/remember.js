import { z } from 'zod';
import { join } from 'path';
import * as fs from '../fs.js';
import { save_note } from '../vault.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('remember', {
		description: 'Save key points or findings from a conversation into the source vault',
		inputSchema: {
			title:   z.string().describe('Topic title'),
			content: z.string().describe('Key points or findings (markdown)'),
			folder:  z.string().optional().describe('Subfolder inside .vicky/sources (e.g. "nanite", "physics")'),
			tags:    z.array(z.string()).optional().describe('Tags'),
		},
	}, async ({ title, content, folder, tags = [] }) => {
		await ensure_init();
		const dir = folder ? join(fs.sources(), folder) : fs.sources();
		const merged = Array.from(new Set(['source', ...tags.filter(t => t !== 'research')]));
		const path = save_note(title, content, { dir, tags: merged, type: 'source' });
		return { content: [{ type: 'text', text: `Saved: ${path}` }] };
	});
}
