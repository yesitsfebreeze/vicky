/**
 * fs.js — single source of truth for all paths.
 *
 * Everything is a function so env vars (VICKY_ROOT, OBSIDIAN_VAULT, OBSIDIAN_EXE)
 * are read at call time, not module-load time. No absolute paths baked in.
 */

import { dirname, join, basename, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

export const root         = () => process.env.VICKY_ROOT || 'vicky';

// Smart KB location: check for vicky/sources first (workspace mode), else use root directly
function kb_base() {
	const r = root();
	const vicky_sources = join(r, 'vicky', 'sources');
	// If VICKY_ROOT points to a workspace parent and vicky/sources exists, use vicky/ as KB base
	if (r !== 'vicky' && existsSync(vicky_sources)) return join(r, 'vicky');
	return r;
}

export const sources      = () => join(kb_base(), 'sources');
export const absorbed     = () => join(sources(), '.absorbed');
export const conclusions  = () => join(kb_base(), 'conclusions');
export const pending      = () => join(kb_base(), 'pending');
export const graphs       = () => join(kb_base(), 'graphs');
export const graphify_out = () => join(kb_base(), '.graphify');
export const kb_graph     = () => join(graphify_out(), 'graph.json');
export const kb_wiki      = () => join(graphs(), 'vicky.md');
export const graphifyignore = () => join(kb_base(), '.graphifyignore');
export const workflow_md  = () => join(kb_base(), 'WORKFLOW.md');
export const dashboard_md = () => join(kb_base(), 'Dashboard.md');
export const report_md    = () => join(kb_base(), 'Dashboard.report.md');
export const template_dir = () => join(SKILL_DIR, '..', 'scaffold');
export const vault_name   = () => process.env.OBSIDIAN_VAULT || basename(resolve(root(), '..'));
export const obsidian_cli = () => process.env.OBSIDIAN_CLI || (process.platform === 'win32' ? 'obsidian.com' : 'obsidian');
