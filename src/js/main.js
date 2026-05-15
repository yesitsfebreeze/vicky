#!/usr/bin/env node

/**
 * Single Vicky entry. Dispatches by argv[2]:
 *   node vicky.js                → mcp (default)
 *   node vicky.js mcp            → MCP stdio server
 *   node vicky.js init           → vault scaffold; prints JSON banner
 *   node vicky.js dashboard      → markdown to stdout
 *   node vicky.js dashboard --write  → write Dashboard.report.md, print path
 *   node vicky.js dashboard --json   → raw Dataview JSON
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
} else if (mode === 'mcp' || mode === undefined) {
	await import('./mcp-server.js');
} else {
	console.error(`vicky: unknown mode "${mode}". Valid: mcp | init | dashboard`);
	process.exit(2);
}
