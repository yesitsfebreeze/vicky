import { exec, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as fs from './fs.js';

const sh_bg = (cmd, opts = {}) => new Promise((res, rej) => {
	const p = spawn(cmd, [], { shell: true, stdio: 'ignore', windowsHide: true, ...opts });
	p.on('close', res);
	p.on('error', rej);
});

const sh_async = (cmd, opts = {}) => new Promise((res, rej) =>
	exec(cmd, { timeout: 60_000, encoding: 'utf8', ...opts }, (err, stdout) => err ? rej(err) : res(stdout ?? ''))
);

let graphifyCli = null;
try {
	const main = require.resolve('graphifyy');
	graphifyCli = join(dirname(main), 'cli.js');
	if (!existsSync(graphifyCli)) graphifyCli = null;
} catch { graphifyCli = null; }

const graphifyCmd = graphifyCli ? `node "${graphifyCli}"` : 'graphify';

let graphifyAvailable = null;

async function checkGraphify() {
	if (graphifyAvailable !== null) return graphifyAvailable;
	if (graphifyCli) { graphifyAvailable = true; return true; }
	try {
		const cmd = process.platform === 'win32' ? 'where graphify' : 'which graphify';
		await sh_async(cmd);
		graphifyAvailable = true;
	} catch (_) {
		graphifyAvailable = false;
		console.error('[vicky] graphify not found. Run `npm install` in vicky root to install the bundled `graphifyy` dep.');
	}
	return graphifyAvailable;
}

export const update_src = async () => {
	if (!(await checkGraphify())) return;
	return sh_bg(`${graphifyCmd} update .`, { cwd: fs.sources() });
};

export const update_con = async () => {
	if (!(await checkGraphify())) return;
	return sh_bg(`${graphifyCmd} update .`, { cwd: fs.conclusions() });
};

export async function query_graph(question, graph) {
	if (!existsSync(graph)) return '';
	if (!(await checkGraphify())) return '';
	try { return await sh_async(`${graphifyCmd} query "${question}" --graph "${graph}"`); } catch (_) { return ''; }
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
