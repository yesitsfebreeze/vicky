#!/usr/bin/env node

/**
 * Vault bootstrap. Creates the vicky/ directory tree and scaffolds the
 * Obsidian preset on first call. Idempotent for user content — never
 * overwrites Dashboard.md, WORKFLOW.md, or anything under vicky/. Always
 * force-writes .obsidian/ config so Obsidian-created stubs (empty
 * community-plugins.json on first vault open) cannot block scaffold delivery.
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

function copy_tree(source, destination, { overwrite = false } = {}) {
	if (!existsSync(source)) return;
	mkdirSync(destination, { recursive: true });
	for (const entry of readdirSync(source, { withFileTypes: true })) {
		const from = join(source, entry.name);
		const to   = join(destination, entry.name);
		if (entry.isDirectory()) copy_tree(from, to, { overwrite });
		else if (entry.isFile() && (overwrite || !existsSync(to))) copyFileSync(from, to);
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
	// Scaffold root contains two top-level entries:
	//   .obsidian/  → force-overwrite (Obsidian writes empty stubs on first vault open
	//                 that would otherwise block scaffold delivery)
	//   vicky/      → skip-if-exists (user content; never clobber)
	for (const entry of readdirSync(fs.template_dir(), { withFileTypes: true })) {
		const from = join(fs.template_dir(), entry.name);
		const overwrite = entry.name === '.obsidian';
		if (entry.isDirectory()) copy_tree(from, entry.name, { overwrite });
		else if (entry.isFile() && (overwrite || !existsSync(entry.name))) copyFileSync(from, entry.name);
	}
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