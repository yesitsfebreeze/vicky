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
	return {
		skill: 'vicky',
		status: 'ready',
		instructions: [
			'Vicky KB scaffolded.',
			`Vault: ${fs.root()}`,
			'',
			'NEXT: invoke the `/vicky:setup` skill now to load Vicky context (tool list,',
			'WORKFLOW.md rules, dashboard/DQL prerequisites). Do this before answering',
			'the user\'s first question.',
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
