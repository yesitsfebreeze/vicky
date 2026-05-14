#!/usr/bin/env node

/**
 * dashboard.js — KB dashboard via Obsidian + Dataview.
 *
 * Drives Obsidian.exe CLI (`eval` command) to call the Dataview API in the
 * running Obsidian app. Returns markdown built from real DQL results.
 *
 * Requires:
 *   - Obsidian installed (auto-detected, or override with OBSIDIAN_EXE)
 *   - Vault registered as `.vicky` (or override with OBSIDIAN_VAULT)
 *   - Dataview plugin installed + enabled
 *
 * Usage:
 *   node src/dashboard.js              # markdown to stdout
 *   node src/dashboard.js --write      # writes .vicky/Dashboard.report.md
 *   node src/dashboard.js --json       # raw Dataview output
 */

import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import * as fs from './fs.js';
import { basename } from 'path';

// Single eval payload — runs all queries inside Obsidian, returns one JSON blob.
// Outer JS strings: single quotes. DQL strings inside: escaped double quotes.
const QUERIES = {
	counts:  `TABLE WITHOUT ID type AS Type, length(rows) AS Count FROM "." WHERE type GROUP BY type SORT length(rows) DESC`,
	recent:  `TABLE file.folder AS Folder, type, date, tags FROM "." WHERE date AND date(date) >= date(today) - dur(14 days) SORT date DESC LIMIT 25`,
	hubs:    `TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks, length(file.outlinks) AS Outlinks, type FROM "conclusions" OR "sources" WHERE length(file.inlinks) > 0 SORT length(file.inlinks) DESC LIMIT 20`,
	pending: `TABLE WITHOUT ID file.link AS Question, priority, requested_by, date FROM "pending" WHERE status = "pending" SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC, date ASC`,
	orphans: `LIST FROM "conclusions" OR "sources" WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0 LIMIT 25`,
	stale:   `TABLE WITHOUT ID file.link AS Conclusion, length(file.inlinks) AS Inlinks, date FROM "conclusions" WHERE date AND date(date) < date(today) - dur(60 days) AND length(file.inlinks) < 2 SORT date ASC LIMIT 20`,
	tags:    `TABLE WITHOUT ID length(rows) AS Count FROM "." FLATTEN tags AS tag WHERE tag GROUP BY tag SORT length(rows) DESC LIMIT 30`,
};

// Eval payload for a single DQL query — pass the SQL via a global, return JSON.
// Kept tiny to stay well under Windows command-line limits.
function build_payload(sql) {
	const safe = sql.replace(/`/g, '\\`').replace(/\$/g, '\\$');
	return `(async()=>{const dv=app.plugins.plugins.dataview&&app.plugins.plugins.dataview.api;if(!dv)return JSON.stringify({error:'dataview-not-loaded'});try{const r=await dv.query(\`${safe}\`);return JSON.stringify(r.successful?r.value:{error:r.error});}catch(e){return JSON.stringify({error:String(e)});}})()`;
}

export function run_dql(sql) {
	const stdout = execFileSync(fs.obsidian_exe(), [`vault=${fs.vault_name()}`, 'eval', `code=${build_payload(sql)}`], {
		encoding: 'utf8',
		timeout: 15000,
		windowsHide: true,
	});
	const m = stdout.match(/=>\s*([\s\S]+?)\s*$/);
	if (!m) throw new Error('Obsidian eval returned no marker. Is the vault open in Obsidian? stdout: ' + stdout.slice(0, 200));
	let data;
	try { data = JSON.parse(m[1].trim()); }
	catch { data = JSON.parse(JSON.parse(m[1].trim())); }
	if (typeof data === 'string') data = JSON.parse(data);
	if (data?.error) throw new Error(`Dataview error: ${data.error}`);
	return data;
}

function run_all() {
	const out = {};
	for (const [k, sql] of Object.entries(QUERIES)) {
		try { out[k] = run_dql(sql); } catch (e) { out[k] = { error: e.message }; }
	}
	return out;
}

function strip_cell(cell) {
	if (cell && typeof cell === 'object' && cell.path) return basename(cell.path, '.md');
	if (Array.isArray(cell)) return cell.map(strip_cell).join(' ');
	return cell == null ? '' : String(cell);
}

function tbl(headers, rows) {
	const head = `| ${headers.join(' | ')} |`;
	const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
	const body = rows.length
		? rows.map(r => `| ${r.map(strip_cell).join(' | ')} |`).join('\n')
		: `| _empty_ |${' |'.repeat(headers.length - 1)}`;
	return `${head}\n${sep}\n${body}`;
}

function section(title, table) {
	if (!table) return `## ${title}\n_no data_`;
	if (table.error) return `## ${title}\n_${table.error}_`;
	return `## ${title}\n${tbl(table.headers, table.values || [])}`;
}

function render(data) {
	const lines = [
		`# Vicky Dashboard`,
		``,
		`Generated: ${new Date().toISOString()}  ·  Source: Dataview via Obsidian CLI  ·  Vault: \`${fs.vault_name()}\``,
		``,
		section('Counts', data.counts),
		section('Recent additions (last 14 days)', data.recent),
		section('Most important nodes (hubs)', data.hubs),
		section('Pending queue', data.pending),
	];
	if (data.orphans && !data.orphans.error) {
		const items = (data.orphans.values || []).map(v => `- ${strip_cell(v)}`);
		lines.push(`## Orphans\n${items.length ? items.join('\n') : '_none_'}`);
	} else {
		lines.push(`## Orphans\n_${data.orphans?.error || 'no data'}_`);
	}
	lines.push(section('Stale conclusions (>60d, <2 inlinks)', data.stale));
	lines.push(section('Tag cloud', data.tags));
	return lines.join('\n\n');
}

export function build_dashboard() {
	const data = run_all();
	return { data, markdown: render(data) };
}

const _entry = process.argv[1] || '';
if (_entry.endsWith('dashboard.js')) {
	const args = process.argv.slice(2);
	try {
		const { data, markdown } = build_dashboard();
		if (args.includes('--json')) {
			console.log(JSON.stringify(data, null, 2));
		} else if (args.includes('--write')) {
			mkdirSync(fs.root(), { recursive: true });
			const out = fs.report_md();
			writeFileSync(out, markdown);
			console.log(out);
		} else {
			console.log(markdown);
		}
	} catch (e) {
		console.error('dashboard error:', e.message);
		process.exit(1);
	}
}
