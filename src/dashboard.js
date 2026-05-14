#!/usr/bin/env node

/**
 * KB dashboard via Obsidian + Dataview.
 *
 * Drives `obsidian eval` to call the Dataview API in the running Obsidian
 * app. Returns markdown built from real DQL results. Each query runs in
 * its own short eval payload to stay well under Windows command-line
 * limits.
 *
 * Usage:
 *   node src/dashboard.js              # markdown to stdout
 *   node src/dashboard.js --write      # writes <vault>/Dashboard.report.md
 *   node src/dashboard.js --json       # raw Dataview JSON
 */

import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { basename } from 'path';
import * as fs from './fs.js';

const QUERIES = {
	counts:  `TABLE WITHOUT ID type AS Type, length(rows) AS Count FROM "." WHERE type GROUP BY type SORT length(rows) DESC`,
	recent:  `TABLE file.folder AS Folder, type, date, tags FROM "." WHERE date AND date(date) >= date(today) - dur(14 days) SORT date DESC LIMIT 25`,
	hubs:    `TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks, length(file.outlinks) AS Outlinks, type FROM "conclusions" OR "sources" WHERE length(file.inlinks) > 0 SORT length(file.inlinks) DESC LIMIT 20`,
	pending: `TABLE WITHOUT ID file.link AS Question, priority, requested_by, date FROM "pending" WHERE status = "pending" SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC, date ASC`,
	orphans: `LIST FROM "conclusions" OR "sources" WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0 LIMIT 25`,
	stale:   `TABLE WITHOUT ID file.link AS Conclusion, length(file.inlinks) AS Inlinks, date FROM "conclusions" WHERE date AND date(date) < date(today) - dur(60 days) AND length(file.inlinks) < 2 SORT date ASC LIMIT 20`,
	tags:    `TABLE WITHOUT ID length(rows) AS Count FROM "." FLATTEN tags AS tag WHERE tag GROUP BY tag SORT length(rows) DESC LIMIT 30`,
};

const EVAL_TIMEOUT_MS = Number(process.env.OBSIDIAN_TIMEOUT_MS) || 10_000;

function payload(sql) {
	const safe = sql.replace(/`/g, '\\`').replace(/\$/g, '\\$');
	return `(async()=>{const dv=app.plugins.plugins.dataview&&app.plugins.plugins.dataview.api;if(!dv)return JSON.stringify({error:'dataview-not-loaded'});try{const r=await dv.query(\`${safe}\`);return JSON.stringify(r.successful?r.value:{error:r.error});}catch(e){return JSON.stringify({error:String(e)});}})()`;
}

function not_open_error() {
	return new Error(
		`Obsidian is not running with the vault "${fs.vault_name()}" open. ` +
		`Open the vault in Obsidian (with the Dataview plugin enabled), then retry. ` +
		`Override the wait window with OBSIDIAN_TIMEOUT_MS.`,
	);
}

export function run_dql(sql) {
	let stdout;
	try {
		stdout = execFileSync(
			fs.obsidian_cli(),
			[`vault=${fs.vault_name()}`, 'eval', `code=${payload(sql)}`],
			{ encoding: 'utf8', timeout: EVAL_TIMEOUT_MS, windowsHide: true },
		);
	} catch (e) {
		if (e.code === 'ETIMEDOUT' || e.killed) throw not_open_error();
		throw e;
	}
	const m = stdout.match(/=>\s*([\s\S]+?)\s*$/);
	if (!m) throw not_open_error();
	const data = JSON.parse(m[1].trim());
	if (data?.error) throw new Error(`Dataview: ${data.error}`);
	return data;
}

function run_all() {
	const out = {};
	for (const [k, sql] of Object.entries(QUERIES)) {
		try { out[k] = run_dql(sql); }
		catch (e) { out[k] = { error: e.message }; }
	}
	return out;
}

function cell(value) {
	if (value && typeof value === 'object' && value.path) return basename(value.path, '.md');
	if (Array.isArray(value)) return value.map(cell).join(' ');
	return value == null ? '' : String(value);
}

function table(headers, rows) {
	const head = `| ${headers.join(' | ')} |`;
	const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
	const body = rows.length
		? rows.map(r => `| ${r.map(cell).join(' | ')} |`).join('\n')
		: `| _empty_ |${' |'.repeat(headers.length - 1)}`;
	return `${head}\n${sep}\n${body}`;
}

function section_table(title, result) {
	if (result?.error) return `## ${title}\n_${result.error}_`;
	if (!result) return `## ${title}\n_no data_`;
	return `## ${title}\n${table(result.headers, result.values || [])}`;
}

function section_list(title, result) {
	if (result?.error) return `## ${title}\n_${result.error}_`;
	const values = result?.values || [];
	if (!values.length) return `## ${title}\n_none_`;
	return `## ${title}\n${values.map(v => `- ${cell(v)}`).join('\n')}`;
}

function render(data) {
	return [
		`# Vicky Dashboard`,
		`Generated: ${new Date().toISOString()}  ·  Vault: \`${fs.vault_name()}\``,
		section_table('Counts', data.counts),
		section_table('Recent additions (last 14 days)', data.recent),
		section_table('Most important nodes (hubs)', data.hubs),
		section_table('Pending queue', data.pending),
		section_list('Orphans (no in/out links)', data.orphans),
		section_table('Stale conclusions (>60d, <2 inlinks)', data.stale),
		section_table('Tag cloud', data.tags),
	].join('\n\n');
}

export function build_dashboard() {
	const data = run_all();
	return { data, markdown: render(data) };
}

const entry = process.argv[1] || '';
if (entry.endsWith('dashboard.js')) {
	const args = process.argv.slice(2);
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
}
