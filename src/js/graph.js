import { exec, spawn } from 'child_process';
import { existsSync, readFileSync, renameSync, cpSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import * as fs from './paths.js';

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
		const cmd = process.platform === 'win32' ? 'where graphify' : 'which graphify';
		await sh_async(cmd);
		graphifyAvailable = true;
	} catch (_) {
		graphifyAvailable = false;
		console.error('[vicky] graphify not found on PATH. Install: `npm i -g graphifyy`');
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

// graphify's per-backend default models require paid quota (e.g. gemini-3.1-pro).
// Pin a free-tier-capable default per backend; override any of them with VICKY_MODEL.
const FREE_MODELS = {
	gemini: 'gemini-2.5-flash',
};

function detect_model(backend) {
	return process.env.VICKY_MODEL?.trim() || FREE_MODELS[backend] || null;
}

export const update_kb = async () => {
	if (!(await checkGraphify())) return { ok: false, reason: 'graphify_missing' };
	const backend = detect_backend();
	if (!backend) {
		console.error('[vicky] no LLM API key in env (GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY / MISTRAL_API_KEY / COHERE_API_KEY). Semantic graph extraction skipped.');
		return { ok: false, reason: 'no_backend' };
	}
	const root = resolve(fs.root());
	const kb_root = resolve(fs.kb_base());
	const extraction_graphify_dir = join(root, '.graphify');
	const kb_graphify_dir = fs.graphify_out();

	// Clear stale graphify output to detect if extraction produces fresh results
	if (existsSync(extraction_graphify_dir)) {
		try { rmSync(extraction_graphify_dir, { recursive: true, force: true }); } catch { /* ignore */ }
	}

	const model = detect_model(backend);
	const modelArg = model ? ` --model "${model}"` : '';
	// Add token-budget to enable chunking for large corpuses (avoids LLM timeouts on >1M word corpuses)
	await sh_bg(`graphify extract "${root}" --scope all --backend ${backend}${modelArg} --token-budget 20000`, { cwd: root });

	// In workspace mode, extraction root ≠ KB base: move results to KB location
	if (extraction_graphify_dir !== kb_graphify_dir && existsSync(extraction_graphify_dir)) {
		try {
			cpSync(extraction_graphify_dir, kb_graphify_dir, { recursive: true, force: true });
		} catch (e) {
			console.warn(`[vicky] Failed to copy graphify results from ${extraction_graphify_dir} to ${kb_graphify_dir}: ${e.message}`);
		}
	}

	const graph = fs.kb_graph();
	if (!existsSync(graph)) return { ok: false, reason: 'no_graph_produced' };
	const wikiDir = fs.graphs();
	await sh_bg(`graphify export wiki --graph "${graph}" --dir "${wikiDir}"`, { cwd: root });
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
		const out = await sh_async(`graphify query "${question}" --graph "${graph}"`);
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

export async function query_graph_hits(question, prefix = null, graphPath = fs.kb_graph(), limit = 10) {
	if (!existsSync(graphPath)) return [];
	if (!(await checkGraphify())) return [];
	let raw = '';
	try { raw = await sh_async(`graphify query "${question}" --graph "${graphPath}"`); } catch (_) { return []; }
	if (!raw) return [];
	const inlink_map = build_inlink_map(graphPath);
	const snippet_map = build_snippet_map(graphPath);
	const root = fs.root().replace(/\\/g, '/');
	const lines = raw.split('\n');
	const seen = new Map();
	let rank = 0;
	for (const line of lines) {
		const m = line.match(/^NODE\s+(.+?)\.md\s+\[/);
		if (!m) continue;
		const src = m[1].replace(/\\/g, '/');
		if (prefix && !(src.includes(`/${prefix}/`) || src.startsWith(`${prefix}/`))) continue;
		const note_path = src.startsWith(root + '/') ? src + '.md' : `${root}/${src}.md`;
		if (seen.has(note_path)) continue;
		const inlinks = inlink_map.get(src + '.md') || inlink_map.get(note_path) || 0;
		const positional = 1 / (1 + rank / 5);
		const inlink_boost = Math.log(1 + inlinks) / 10;
		const score = +(0.5 + positional * 0.3 + Math.min(0.2, inlink_boost)).toFixed(4);
		const snippet = (snippet_map.get(src + '.md') || snippet_map.get(note_path) || '').slice(0, 200);
		seen.set(note_path, { note_path, score, inlinks, snippet });
		rank++;
		if (seen.size >= limit) break;
	}
	return [...seen.values()];
}

function build_inlink_map(graphPath) {
	const map = new Map();
	try {
		const { nodes = [], edges = [] } = JSON.parse(readFileSync(graphPath, 'utf8'));
		const node_file = new Map();
		for (const n of nodes) {
			if (n.source_file) node_file.set(n.id ?? n.node_id ?? n.name, n.source_file.replace(/\\/g, '/'));
		}
		for (const e of edges) {
			const target = e.target ?? e.to ?? e.dst;
			const f = node_file.get(target);
			if (!f) continue;
			map.set(f, (map.get(f) || 0) + 1);
		}
	} catch (_) { /* ignore */ }
	return map;
}

function build_snippet_map(graphPath) {
	const map = new Map();
	try {
		const { nodes = [] } = JSON.parse(readFileSync(graphPath, 'utf8'));
		for (const n of nodes) {
			if (!n.source_file) continue;
			const f = n.source_file.replace(/\\/g, '/');
			if (map.has(f)) continue;
			const text = n.source_text || n.text || n.name || '';
			if (text) map.set(f, String(text).replace(/\s+/g, ' ').trim());
		}
	} catch (_) { /* ignore */ }
	return map;
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
