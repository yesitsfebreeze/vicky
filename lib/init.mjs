#!/usr/bin/env node
/**
 * Vicky KB Skill Init
 *
 * Called on every session start.
 * Creates vault structure if needed.
 * Returns instructions.
 * No-op if already initialized.
 */

import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export async function init() {
	const vickyRoot = process.env.VICKY_ROOT || resolve('.vicky');

	// Create vault structure if not exists
	const dirs = [
		`${vickyRoot}/sources`,
		`${vickyRoot}/conclusions`,
		`${vickyRoot}/pending`,
		`${vickyRoot}/graphs`
	];

	dirs.forEach(dir => {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	});

	// Return instructions (always)
	return {
		skill: 'vicky',
		status: 'ready',
		instructions: `
Vicky KB Active (Auto-initialized)

Default behavior: Questions automatically check KB via /vic:research-gap
- Found? Returns context
- Gap? Auto-enqueues research → run /vic:research to process

Commands:
  /vic:research-gap "question"  - Query KB, auto-enqueue gaps
  /vic:research                 - Process gap queue, enrich conclusions
  /vic:remember "title"         - Save findings to vault
  /vic:init                     - Bootstrap vault (already done)

No manual setup needed. Just ask questions.
Vault: ${vickyRoot}
		`.trim()
	};
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
	const result = await init();
	console.log(JSON.stringify(result, null, 2));
}

export default init;
