#!/usr/bin/env node

/**
 * Vault bootstrap. Creates the .vicky/ directory tree and scaffolds the
 * Obsidian preset on first call. Idempotent — never overwrites existing
 * files. Subsequent calls return cached banner instructions without
 * touching the filesystem.
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';

function copy_tree(source, destination) {
	if (!existsSync(source)) return;
	mkdirSync(destination, { recursive: true });
	for (const entry of readdirSync(source, { withFileTypes: true })) {
		const from = join(source, entry.name);
		const to   = join(destination, entry.name);
		if (entry.isDirectory()) copy_tree(from, to);
		else if (entry.isFile() && !existsSync(to)) copyFileSync(from, to);
	}
}

function banner() {
	const root = fs.root();
	return {
		skill: 'vicky',
		status: 'ready',
		instructions: [
			'Vicky KB Active',
			'',
			`Read ${fs.workflow_md()} first — focus, rules, routing.`,
			'',
			'Default behavior: questions auto-check KB via research-gap.',
			'- Found? Returns context, focus-biased.',
			'- Gap?   Auto-enqueues research. Run research to drain.',
			'',
			'Tools:',
			'  research-gap "question"  Query KB, auto-enqueue gaps',
			'  research                 Drain pending queue',
			'  remember "title"         Save findings',
			'  dashboard                KB report via Obsidian + Dataview',
			'  dql "<query>"            Run arbitrary DQL (query="help" for syntax)',
			'',
			'Dashboard + DQL require Obsidian running with the vault open and Dataview enabled.',
			`Live view: ${fs.dashboard_md()}`,
			`Vault:     ${root}`,
		].join('\n'),
	};
}

let initialized = false;

export async function init() {
	for (const directory of [fs.sources(), fs.conclusions(), fs.pending(), fs.graphs()]) {
		if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
	}
	copy_tree(fs.template_dir(), fs.root());
	initialized = true;
	return banner();
}

export async function ensure_init() {
	if (initialized) return banner();
	return init();
}

const entry = process.argv[1] || '';
if (entry.endsWith('init.js')) {
	const result = await init();
	console.log(JSON.stringify(result, null, 2));
}

export default init;
