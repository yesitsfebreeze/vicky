import { exec, spawn } from 'child_process';
import { existsSync, readFileSync, renameSync } from 'fs';
import { dirname, join, resolve } from 'path';
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

function detect_backend() {
	if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
	if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
	if (process.env.OPENAI_API_KEY) return 'openai';
	if (process.env.MISTRAL_API_KEY) return 'mistral';
	if (process.env.COHERE_API_KEY) return 'cohere';
	return null;
}

export const update_kb = async () => {
	if (!(await checkGraphify())) return { ok: false, reason: 'graphify_missing' };
	const backend = detect_backend();
	if (!backend) {
		console.error('[vicky] no LLM API key in env (GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY / MISTRAL_API_KEY / COHERE_API_KEY). Semantic graph extraction skipped.');
		return { ok: false, reason: 'no_backend' };
	}
	const root = resolve(fs.root());
	await sh_bg(`${graphifyCmd} extract "${root}" --scope all --backend ${backend}`, { cwd: root });
	const graph = fs.kb_graph();
	if (!existsSync(graph)) return { ok: false, reason: 'no_graph_produced' };
	const wikiDir = fs.graphs();
	await sh_bg(`${graphifyCmd} export wiki --graph "${graph}" --dir "${wikiDir}"`, { cwd: root });
	const idx = join(wikiDir, 'index.md');
	if (existsSync(idx)) {
		try { renameSync(idx, fs.kb_wiki()); } catch { /* ignore */ }
	}
	return { ok: true, backend };
};

export async function query_graph(question, graph = fs.kb_graph(), prefix = null) {
	if (!existsSync(graph)) return '';
	if (!(await checkGraphify())) return '';
	try {
		const out = await sh_async(`${graphifyCmd} query "${question}" --graph "${graph}"`);
		if (!prefix) return out;
		return filter_nodes_by_prefix(out, prefix);
	} catch (_) { return ''; }
}

function filter_nodes_by_prefix(raw, prefix) {
	if (!raw) return '';
	return raw.split('\n').filter(line => {
		const m = line.match(/^NODE\s+(.+?)\s+\[/);
		if (!m) return true;
		return m[1].startsWith(prefix);
	}).join('\n');
}

export function list_titles_from_graph(graphPath = fs.kb_graph(), prefix = null) {
	if (!existsSync(graphPath)) return [];
	try {
		const { nodes } = JSON.parse(readFileSync(graphPath, 'utf8'));
		return [...new Set(
			nodes
				.filter(n => n.source_location === 'L1' && n.source_file?.endsWith('.md'))
				.filter(n => !prefix || n.source_file.replace(/\\/g, '/').includes(`/${prefix}/`) || n.source_file.startsWith(`${prefix}/`))
				.map(n => n.source_file.split(/[/\\]/).pop().replace(/\.md$/, ''))
		)];
	} catch (_) { return []; }
}
