import { exec, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as fs from './fs.js';

const sh_bg = (cmd, opts = {}) => new Promise((res, rej) => {
	const p = spawn(cmd, [], { shell: true, stdio: 'ignore', windowsHide: true, ...opts });
	p.on('close', res);
	p.on('error', rej);
});

const sh_async = (cmd, opts = {}) => new Promise((res, rej) =>
	exec(cmd, { timeout: 60_000, encoding: 'utf8', ...opts }, (err, stdout) => err ? rej(err) : res(stdout ?? ''))
);

let graphifyAvailable = null;

async function checkGraphify() {
	if (graphifyAvailable !== null) return graphifyAvailable;
	try {
		const platform = process.platform;
		const cmd = platform === 'win32' ? 'where graphify' : 'which graphify';
		await sh_async(cmd);
		graphifyAvailable = true;
	} catch (_) {
		graphifyAvailable = false;
		console.error('[vicky] graphify CLI not found. Install with: npm install -g @anthropics/graphify');
	}
	return graphifyAvailable;
}

export const update_src = async () => {
	if (!(await checkGraphify())) return;
	return sh_bg('graphify update .', { cwd: fs.sources() });
};

export const update_con = async () => {
	if (!(await checkGraphify())) return;
	return sh_bg('graphify update .', { cwd: fs.conclusions() });
};

export async function query_graph(question, graph) {
	if (!existsSync(graph)) return '';
	if (!(await checkGraphify())) return '';
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
