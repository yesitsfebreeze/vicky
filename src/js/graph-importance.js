import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';

/**
 * Analyze file importance based on AST dependencies and grep frequency.
 * Identifies which files are most referenced/important for indexing prioritization.
 */

export async function analyzeFileImportance(limit = 30) {
	const astPath = join(fs.root(), '.graphify', '.graphify_ast.json');

	if (!existsSync(astPath)) {
		return { ok: false, reason: 'no_ast', message: 'Run graphify extract first to generate AST' };
	}

	console.log('[vicky] Analyzing file importance from AST...');

	try {
		const ast = JSON.parse(readFileSync(astPath, 'utf8'));

		// Build dependency graph from AST nodes
		const fileReferences = {};
		const fileInfo = {};

		if (ast.nodes) {
			for (const node of ast.nodes) {
				if (!node.file) continue;

				// Count each file
				fileReferences[node.file] = (fileReferences[node.file] || 0) + 1;

				// Store file info
				if (!fileInfo[node.file]) {
					fileInfo[node.file] = {
						file: node.file,
						ast_nodes: 0,
						references: 0,
						type: node.type,
						language: node.language,
					};
				}
				fileInfo[node.file].ast_nodes++;

				// Track edges (imports/references)
				if (node.edges) {
					for (const edge of node.edges) {
						if (edge.target_file && edge.target_file !== node.file) {
							fileInfo[node.file].references = (fileInfo[node.file].references || 0) + 1;
						}
					}
				}
			}
		}

		// Grep-based frequency analysis for additional signal
		console.log('[vicky] Grep analysis for file references...');
		const grepCounts = {};
		try {
			const root = fs.root();
			const pattern = Object.keys(fileInfo)
				.slice(0, 50)  // Top 50 from AST
				.map(f => f.split('/').pop())
				.join('\\|');

			if (pattern) {
				const cmd = `grep -r "${pattern}" "${root}" --include="*.ts" --include="*.tsx" --include="*.vue" --include="*.php" --include="*.js" 2>/dev/null | cut -d: -f1 | sort | uniq -c | sort -rn`;
				const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

				for (const line of output.split('\n')) {
					const match = line.trim().match(/^(\d+)\s+(.+)$/);
					if (match) {
						grepCounts[match[2]] = parseInt(match[1]);
					}
				}
			}
		} catch (e) {
			console.warn('[vicky] Grep analysis failed, using AST data only');
		}

		// Git commit frequency analysis
		console.log('[vicky] Git history analysis...');
		const gitCounts = {};
		try {
			const root = fs.root();
			const cmd = `cd "${root}" && git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -100`;
			const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

			for (const line of output.split('\n')) {
				const match = line.trim().match(/^(\d+)\s+(.+)$/);
				if (match && match[2]) {
					gitCounts[match[2]] = parseInt(match[1]);
				}
			}
		} catch (e) {
			console.warn('[vicky] Git analysis skipped (not a git repo or access issue)');
		}

		// Score files: AST nodes + grep frequency + git commits + edges
		const scored = Object.entries(fileInfo).map(([file, info]) => ({
			file,
			ast_score: info.ast_nodes * 10,
			grep_score: grepCounts[file] || 0,
			git_score: gitCounts[file] || 0,
			reference_score: info.references * 5,
			total_score: (info.ast_nodes * 10) + (grepCounts[file] || 0) + (gitCounts[file] || 0) + (info.references * 5),
			language: info.language,
		}));

		// Sort by total score
		scored.sort((a, b) => b.total_score - a.total_score);

		const top = scored.slice(0, limit);

		console.log(`\n[vicky] Top ${limit} most important files:\n`);
		for (let i = 0; i < top.length; i++) {
			const f = top[i];
			console.log(`${i + 1}. ${f.file}`);
			console.log(`   Score: ${f.total_score} (AST: ${f.ast_score}, Grep: ${f.grep_score}, Refs: ${f.reference_score})`);
			console.log(`   Language: ${f.language}`);
		}

		// Generate source priority list (markdown for vicky docs)
		const markdown = `# File Importance Analysis

Generated from AST + grep frequency analysis.

## Top ${limit} Files by Importance Score

| Rank | File | Score | Language | Notes |
|------|------|-------|----------|-------|
${top.map((f, i) => `| ${i+1} | \`${f.file}\` | ${f.total_score} | ${f.language} | AST: ${f.ast_score}, Grep: ${f.grep_score}, Refs: ${f.reference_score} |`).join('\n')}

## Indexing Priority

Create vicky sources in this order for highest-value KB coverage.`;

		return {
			ok: true,
			top_files: top.map(f => f.file),
			scores: top,
			markdown,
			total_analyzed: scored.length,
		};
	} catch (e) {
		return { ok: false, reason: 'parse_error', message: e.message };
	}
}

export default analyzeFileImportance;
