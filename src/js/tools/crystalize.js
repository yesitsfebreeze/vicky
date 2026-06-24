import { z } from 'zod';
import { readFileSync } from 'fs';
import { basename } from 'path';
import * as fs from '../paths.js';
import {
  absorb_source,
  find_source,
  patch_frontmatter_derived_from,
  patch_frontmatter_sources,
  parse_fm_list,
} from '../vault.js';
import { resolve_slug, slugify } from '../slug.js';
import { ensure_init } from '../init.js';

function find_conclusion(name) {
  return resolve_slug(name, fs.conclusions());
}

export function register(server) {
	server.registerTool('crystalize', {
		description: 'Condense KB by absorbing source(s) into a conclusion. Moves source files to vicky/sources/.absorbed/ (hidden dotfolder, excluded from graph) and appends them to the conclusion derived_from: frontmatter. Absorbed slugs are removed from sources:. dry_run=true previews moves. Run /vicky:learn after to rebuild graph.',
		inputSchema: {
			conclusion: z.string().describe('Conclusion title or slug to crystalize into'),
			absorb: z.array(z.string()).min(1).describe('Source IDs (hash filenames, with or without .md) to absorb into the conclusion derived_from frontmatter.'),
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
		const resolved_moves = [];
		const missing = [];
		for (const name of absorb) {
			const slug = slugify(name);
			const srcPath = find_source(slug);
			if (!srcPath) { missing.push(slug); continue; }
			moves.push(slug);
			resolved_moves.push(basename(srcPath, '.md'));
		}

		const new_derived = [...new Set([...existing_derived, ...resolved_moves].map(slugify))];
		const absorbed_slugs = new Set(resolved_moves.map(slugify));
		const new_sources = existing_sources.filter(s => !absorbed_slugs.has(slugify(s)));

		if (dry_run) {
			return { content: [{ type: 'text', text: JSON.stringify({
				conclusion: concPath,
				would_absorb_input: moves,
				would_absorb_resolved: resolved_moves,
				missing,
				new_sources,
				new_derived_from: new_derived,
			}, null, 2) }] };
		}

		for (const resolved of resolved_moves) absorb_source(resolved);
		patch_frontmatter_sources(concPath, new_sources);
		patch_frontmatter_derived_from(concPath, new_derived);

		return { content: [{ type: 'text', text:
			`Crystalized ${resolved_moves.length} source(s) into ${conclusion}.\n` +
			`Absorbed (resolved): ${resolved_moves.join(', ') || 'none'}\n` +
			`Input slugs: ${moves.join(', ') || 'none'}\n` +
			`Missing: ${missing.join(', ') || 'none'}\n` +
			`Run /vicky:learn to rebuild graph.`
		}] };
	});
}
