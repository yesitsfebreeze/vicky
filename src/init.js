#!/usr/bin/env node
/**
 * Vicky KB Skill Init
 *
 * Called on every session start.
 * Creates vault structure if needed.
 * Returns instructions.
 * No-op if already initialized.
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';

function copy_tree(src, dst) {
	if (!existsSync(src)) return;
	mkdirSync(dst, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		const from = join(src, entry.name);
		const to = join(dst, entry.name);
		if (entry.isDirectory()) {
			copy_tree(from, to);
		} else if (entry.isFile() && !existsSync(to)) {
			copyFileSync(from, to);
		}
	}
}

export async function init() {
	const vickyRoot = fs.root();

	for (const dir of [fs.sources(), fs.conclusions(), fs.pending(), fs.graphs()]) {
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	}

	// Scaffold Obsidian / Dataview templates (idempotent, never overwrites)
	copy_tree(fs.template_dir(), vickyRoot);

	return {
		skill: 'vicky',
		status: 'ready',
		instructions: `
Vicky KB Active (Auto-initialized)

Read ${vickyRoot}/WORKFLOW.md first — it configures focus, rules, and routing.

Default behavior: Questions automatically check KB via /vic:research-gap
- Found? Returns context (focus-biased per WORKFLOW.md)
- Gap? Auto-enqueues research → run /vic:research to process

Commands:
  /vic:research-gap "question"  - Query KB, auto-enqueue gaps
  /vic:research                 - Process gap queue, enrich conclusions
  /vic:remember "title"         - Save findings to vault
  /vic:init                     - Bootstrap vault (already done)
  dashboard tool                - KB report via Obsidian + Dataview
  dql tool                      - Run arbitrary DQL query (use query="help" for syntax)

Dashboard + DQL require Obsidian running with .vicky open and Dataview enabled.
Obsidian view: open ${vickyRoot}/Dashboard.md for the live human view.

Vault: ${vickyRoot}
		`.trim()
	};
}

export async function ensure_init() {
	return await init();
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const result = await init();
	console.log(JSON.stringify(result, null, 2));
}

export default init;
