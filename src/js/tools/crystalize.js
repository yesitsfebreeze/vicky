import { z } from 'zod';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as fs from '../fs.js';
import {
	absorb_source,
	patch_frontmatter_derived_from,
	patch_frontmatter_sources,
	parse_fm_list,
} from '../vault.js';
import { ensure_init } from '../init.js';

function find_conclusion(name) {
	const slug = name.replace(/\.md$/, '');
	const stack = [fs.conclusions()];
	while (stack.length) {
		const d = stack.pop();
		if (!existsSync(d)) continue;
		for (const e of readdirSync(d, { withFileTypes: true })) {
			if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
			const full = join(d, e.name);
			if (e.isDirectory()) stack.push(full);
			else if (e.name === `${slug}.md`) return full;
		}
	}
	return null;
}

export function register(server) {
	server.registerTool('crystalize', {
		description: 'Condense KB by absorbing source(s) into a conclusion. Moves source files to vicky/sources/.absorbed/ (hidden dotfolder, excluded from graph) and appends them to the conclusion derived_from: frontmatter. Absorbed slugs are removed from sources:. dry_run=true previews moves. Run /vicky:learn after to rebuild graph.',
		inputSchema: {
			conclusion: z.string().describe('Conclusion title or slug to crystalize into'),
			absorb: z.array(z.string()).min(1).describe('Source slugs (with or without .md) to absorb'),
			dry_run: z.boolean().optional().describe('Preview moves only, default false'),
		},
	}, async ({ conclusion, absorb, dry_run = false }) => {
		await ensure_init();
		const concPath = find_conclusion(conclusion);
		if (!concPath) {
			return { content: [{ type: 'text', text: `Error: conclusion not found: ${conclusion}` }] };
		}

		const concContent = readFileSync(concPath, 'utf8');
		const existing_sources = parse_fm_list(concContent, 'sources');
		const existing_derived = parse_fm_list(concContent, 'derived_from');

		const moves = [];
		const missing = [];
		for (const name of absorb) {
			const slug = name.replace(/\.md$/, '');
			const srcPath = join(fs.sources(), `${slug}.md`);
			if (!existsSync(srcPath)) { missing.push(slug); continue; }
			moves.push(slug);
		}

		const new_derived = [...new Set([...existing_derived, ...moves])];
		const new_sources = existing_sources.filter(s => !moves.includes(s));

		if (dry_run) {
			return { content: [{ type: 'text', text: JSON.stringify({
				conclusion: concPath,
				would_absorb: moves,
				missing,
				new_sources,
				new_derived_from: new_derived,
			}, null, 2) }] };
		}

		for (const slug of moves) absorb_source(slug);
		patch_frontmatter_sources(concPath, new_sources);
		patch_frontmatter_derived_from(concPath, new_derived);

		return { content: [{ type: 'text', text:
			`Crystalized ${moves.length} source(s) into ${conclusion}.\n` +
			`Absorbed: ${moves.join(', ') || 'none'}\n` +
			`Missing: ${missing.join(', ') || 'none'}\n` +
			`Run /vicky:learn to rebuild graph.`
		}] };
	});
}
