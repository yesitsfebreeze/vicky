/**
 * fs.js — single source of truth for all paths.
 *
 * Everything is a function so env vars (VICKY_ROOT, OBSIDIAN_VAULT, OBSIDIAN_EXE)
 * are read at call time, not module-load time. No absolute paths baked in.
 */

import { dirname, join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

export const root         = () => process.env.VICKY_ROOT || 'vicky';
export const sources      = () => join(root(), 'sources');
export const conclusions  = () => join(root(), 'conclusions');
export const research     = () => join(root(), 'research');
export const pending      = () => join(root(), 'pending');
export const graphs       = () => join(root(), 'graphs');
export const graphify_out = () => join(root(), '.graphify');
export const kb_graph     = () => join(graphify_out(), 'graph.json');
export const kb_wiki      = () => join(graphs(), 'vicky.md');
export const graphifyignore = () => join(root(), '.graphifyignore');
export const workflow_md  = () => join(root(), 'WORKFLOW.md');
export const dashboard_md = () => join(root(), 'Dashboard.md');
export const report_md    = () => join(root(), 'Dashboard.report.md');
export const template_dir = () => join(SKILL_DIR, '..', 'scaffold');
export const vault_name   = () => process.env.OBSIDIAN_VAULT || basename(resolve(root(), '..'));
export const obsidian_cli = () => process.env.OBSIDIAN_CLI || (process.platform === 'win32' ? 'obsidian.com' : 'obsidian');
