#!/usr/bin/env node

/**
 * Single Vicky entry. Dispatches by argv[2]:
 *   node vicky.js                → mcp (default)
 *   node vicky.js mcp            → MCP stdio server
 *   node vicky.js init           → vault scaffold; prints JSON banner
 *   node vicky.js dashboard      → markdown to stdout
 *   node vicky.js dashboard --write  → write Dashboard.report.md, print path
 *   node vicky.js dashboard --json   → raw Dataview JSON
 *   node vicky.js tag-context    → UserPromptSubmit hook; reads {prompt} from stdin, prints matching conclusion notes
 *   node vicky.js graph-importance [limit] → analyze file importance from AST, recommend sources to index
 */

const mode = process.argv[2] || 'mcp';

if (mode === 'init') {
	const { init } = await import('./init.js');
	const result = await init();
	console.log(JSON.stringify(result, null, 2));
} else if (mode === 'dashboard') {
	const args = process.argv.slice(3);
	const { build_dashboard } = await import('./dashboard.js');
	const { mkdirSync, writeFileSync } = await import('fs');
	const fs = await import('./fs.js');
	try {
		const { data, markdown } = build_dashboard();
		if (args.includes('--json')) {
			console.log(JSON.stringify(data, null, 2));
		} else if (args.includes('--write')) {
			mkdirSync(fs.root(), { recursive: true });
			writeFileSync(fs.report_md(), markdown);
			console.log(fs.report_md());
		} else {
			console.log(markdown);
		}
	} catch (e) {
		console.error(`dashboard: ${e.message}`);
		process.exit(1);
	}
} else if (mode === 'tag-context') {
	try {
		const chunks = [];
		for await (const chunk of process.stdin) {
			chunks.push(chunk);
		}
		const raw = Buffer.concat(chunks).toString('utf8').trim();
		let prompt = '';
		try {
			const payload = JSON.parse(raw);
			prompt = (typeof payload.prompt === 'string') ? payload.prompt : '';
		} catch (_) {
			// non-JSON or empty stdin — silently skip
		}
		if (prompt) {
			const { collect_tags, build_context } = await import('./hooks/tag-context.js');
			const out = build_context(prompt, collect_tags());
			if (out) console.log(out);
		}
	} catch (_) {
		// swallow all errors — never block the prompt
	}
	process.exit(0);
} else if (mode === 'graph-importance') {
	try {
		const limit = parseInt(process.argv[3]) || 30;
		const { analyzeFileImportance } = await import('./graph-importance.js');
		const result = await analyzeFileImportance(limit);
		if (result.ok) {
			console.log(`\n${result.markdown}\n`);
			console.log(`\nAnalyzed ${result.total_analyzed} files. Priority order in vicky sources.`);
		} else {
			console.error(`graph-importance: ${result.message}`);
			process.exit(1);
		}
	} catch (e) {
		console.error(`graph-importance: ${e.message}`);
		process.exit(1);
	}
} else if (mode === 'mcp' || mode === undefined) {
	await import('./mcp-server.js');
} else {
	console.error(`vicky: unknown mode "${mode}". Valid: mcp | init | dashboard | tag-context | graph-importance`);
	process.exit(2);
}
