import { z } from 'zod';
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { RES, CON } from '../conf.js';
import { ensure_init } from '../init.js';

export function register(server) {
	server.registerTool('complete-research', {
		description: 'Mark research as complete: checks for ## Research section, validates confidence, auto-promotes to conclusions',
		inputSchema: {
			file: z.string().optional().describe('Filename to complete (with or without .md). If omitted, processes all research/ files with ## Research'),
			minConfidence: z.number().optional().default(0.5).describe('Min confidence (0-1): checks ## Research section length. 0.5 = at least 500 chars'),
		},
	}, async ({ file, minConfidence = 0.5 }) => {
		await ensure_init();

		const results = [];

		// Get files to process
		let filesToProcess = [];
		if (file) {
			const filename = file.endsWith('.md') ? file : `${file}.md`;
			if (existsSync(join(RES, filename))) {
				filesToProcess = [filename];
			} else {
				return { content: [{
					type: 'text',
					text: `Error: File not found: ${filename}`
				}] };
			}
		} else {
			// Process all research files
			if (existsSync(RES)) {
				filesToProcess = readdirSync(RES).filter(f => f.endsWith('.md'));
			}
		}

		for (const filename of filesToProcess) {
			const fromPath = join(RES, filename);
			const toPath = join(CON, filename);

			// Read content
			const content = readFileSync(fromPath, 'utf8');

			// Check for ## Research section
			const researchMatch = content.match(/^## Research\s*\n([\s\S]*?)(?=^##|$)/m);
			if (!researchMatch) {
				results.push({ file: filename, status: 'skip', reason: 'No ## Research section found' });
				continue;
			}

			const researchBody = researchMatch[1].trim();
			const confidence = Math.min(1, researchBody.length / 500); // 500 chars = 1.0 confidence

			if (confidence < minConfidence) {
				results.push({
					file: filename,
					status: 'skip',
					reason: `Low confidence: ${(confidence * 100).toFixed(0)}% (need ${(minConfidence * 100).toFixed(0)}%)`
				});
				continue;
			}

			// Promote: update type in frontmatter
			let promoted = content.replace(/^type: research$/m, 'type: conclusion');

			// Remove 'from-queue' tag if present
			promoted = promoted.replace(/,?\s*from-queue\s*,?/g, ',');
			promoted = promoted.replace(/\[\s*,/g, '[');
			promoted = promoted.replace(/,\s*\]/g, ']');
			promoted = promoted.replace(/\[\s*\]/g, '[]');

			// Write to conclusions
			writeFileSync(toPath, promoted, 'utf8');
			unlinkSync(fromPath);

			results.push({
				file: filename,
				status: 'promoted',
				confidence: (confidence * 100).toFixed(0) + '%'
			});
		}

		const summary = results
			.map(r => `- ${r.file}: ${r.status}${r.reason ? ` (${r.reason})` : ''}${r.confidence ? ` [${r.confidence}]` : ''}`)
			.join('\n');

		return { content: [{
			type: 'text',
			text: `Complete research results:\n\n${summary}`
		}] };
	});
}
