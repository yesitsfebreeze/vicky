import { exec, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { SRC, CON } from './conf.js';

const sh_bg = (cmd, opts = {}) => new Promise((res, rej) => {
	const p = spawn(cmd, [], { shell: true, stdio: 'ignore', windowsHide: true, ...opts });
	p.on('close', res);
	p.on('error', rej);
});

const sh_async = (cmd, opts = {}) => new Promise((res, rej) =>
	exec(cmd, { timeout: 60_000, encoding: 'utf8', ...opts }, (err, stdout) => err ? rej(err) : res(stdout ?? ''))
);

export const update_src = () => sh_bg('graphify update .', { cwd: resolve(SRC) });
export const update_con = () => sh_bg('graphify update .', { cwd: resolve(CON) });

export async function query_graph(question, graph) {
	if (!existsSync(graph)) return '';
	try { return await sh_async(`graphify query "${question}" --graph "${graph}"`); } catch (_) { return ''; }
}

export function list_titles_from_graph(graphPath) {
	if (!existsSync(graphPath)) return [];
	try {
		const { nodes } = JSON.parse(readFileSync(graphPath, 'utf8'));
		return [...new Set(
			nodes
				.filter(n => n.source_location === 'L1' && n.source_file?.endsWith('.md'))
				.map(n => n.source_file.split('/').pop().replace(/\.md$/, ''))
		)];
	} catch (_) { return []; }
}
