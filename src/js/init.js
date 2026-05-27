#!/usr/bin/env node

/**
 * Vault bootstrap. Creates the vicky/ directory tree and scaffolds the
 * Obsidian preset on first call. Idempotent — never overwrites existing
 * files. Subsequent calls return cached banner instructions without
 * touching the filesystem.
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';

const GRAPHIFYIGNORE = [
	'# Vicky-managed — controls graphify extract scope.',
	'# Keep sources/ and conclusions/ as the only content corpora.',
	'pending/',
	'sources/.absorbed/',
	'graphs/',
	'.graphify/',
	'.obsidian/',
	'node_modules/',
	'Dashboard.md',
	'Dashboard.report.md',
	'WORKFLOW.md',
	'',
].join('\n');

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
	for (const directory of [fs.sources(), fs.conclusions()]) {
		if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
	}
	copy_tree(fs.template_dir(), '.');
	const ignore = fs.graphifyignore();
	if (!existsSync(ignore)) writeFileSync(ignore, GRAPHIFYIGNORE);
	initialized = true;
	return banner();
}

export async function ensure_init() {
	if (initialized) return banner();
	return init();
}

export default init;
