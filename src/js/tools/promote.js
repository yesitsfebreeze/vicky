import { z } from 'zod';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import * as fs from '../fs.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('promote', {
		description: 'Move a research item from research/ to conclusions/ after findings added',
		inputSchema: {
			file: z.string().describe('Filename (with or without .md extension)'),
			type: z.enum(['research', 'conclusion']).optional().describe('Type: "research" (default) to "conclusion"'),
		},
	}, async ({ file, type = 'research' }) => {
		await ensure_init();

		const filename = file.endsWith('.md') ? file : `${file}.md`;
		const fromDir = type === 'research' ? fs.research() : fs.conclusions();
		const toDir = type === 'research' ? fs.conclusions() : fs.research();
		const fromPath = join(fromDir, filename);
		const toPath = join(toDir, filename);

		if (!existsSync(fromPath)) {
			return { content: [{
				type: 'text',
				text: `Error: File not found at ${fromPath}`
			}] };
		}

		// Read, update, write
		let content = readFileSync(fromPath, 'utf8');

		// Update frontmatter type
		const oldType = type === 'research' ? 'research' : 'conclusion';
		const newType = type === 'research' ? 'conclusion' : 'research';
		content = content.replace(/^type: research$/m, `type: ${newType}`);
		content = content.replace(/^type: conclusion$/m, `type: ${newType}`);

		// Remove 'from-queue' tag if present
		if (type === 'research') {
			content = content.replace(/from-queue/g, '');
			content = content.replace(/tags: \[\s*,\s*/g, 'tags: [');
			content = content.replace(/,\s*\]/g, ']');
		}

		writeFileSync(toPath, content, 'utf8');
		unlinkSync(fromPath);

		return { content: [{
			type: 'text',
			text: `Promoted: ${fromPath} → ${toPath}`
		}] };
	});
}
