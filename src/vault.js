import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';


export function search(dir, query) {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	const hits = [];
	function walk(d) {
		if (!existsSync(d)) return;
		for (const e of readdirSync(d, { withFileTypes: true })) {
			if (e.name.startsWith('.')) continue;
			const full = join(d, e.name);
			if (e.isDirectory()) { walk(full); continue; }
			if (!e.name.endsWith('.md')) continue;
			const text = readFileSync(full, 'utf8');
			const lower = text.toLowerCase();
			const score = terms.filter(t => lower.includes(t)).length;
			if (!score) continue;
			const lines = text.split('\n');
			const idx = lines.findIndex(l => terms.some(t => l.toLowerCase().includes(t)));
			hits.push({ file: e.name, score, snippet: lines.slice(Math.max(0, idx - 1), idx + 5).join('\n') });
		}
	}
	walk(dir);
	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, 5).map(h => `### ${h.file}\n${h.snippet}`).join('\n\n---\n\n') || null;
}

const safe_name = t => t.replace(/[^\w\s-]/g, '').trim().slice(0, 60).replace(/\s+/g, '-');
const safe_link = t => t.replace(/["'[\]|#^\\]/g, '').trim();

export function save_note(title, body, { dir = fs.sources(), tags = [], type = 'source' } = {}) {
	const date = new Date().toISOString().split('T')[0];
	const safe = safe_name(title);
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${safe}.md`);
	writeFileSync(path, `---\ntitle: ${safe}\ndate: ${date}\ntype: ${type}\ntags: [${tags.join(', ')}]\n---\n\n${body}\n`);
	return path;
}

export const save_research = (question, body) =>
	save_note(question, body, { dir: fs.research(), tags: ['research'], type: 'research' });

export function enqueue_research(question, { context = '', requested_by = '', priority = 'med' } = {}) {
	const date = new Date().toISOString().split('T')[0];
	const safe = safe_name(question);
	mkdirSync(fs.pending(), { recursive: true });
	const path = join(fs.pending(), `${safe}.md`);
	if (existsSync(path)) return path;
	const body = `---
title: ${safe}
date: ${date}
type: research-pending
status: pending
requested_by: ${requested_by}
priority: ${priority}
tags: [research, pending]
---

## Question
${question}

## Context
${context}
`;
	writeFileSync(path, body);
	return path;
}

export function list_pending() {
	if (!existsSync(fs.pending())) return [];
	return readdirSync(fs.pending()).filter(f => f.endsWith('.md'));
}

export function read_pending(file) {
	const fp = join(fs.pending(), file);
	const text = readFileSync(fp, 'utf8');
	const q = text.match(/## Question\s*\n([\s\S]*?)(?=\n## |$)/);
	const c = text.match(/## Context\s*\n([\s\S]*?)(?=\n## |$)/);
	return {
		path: fp,
		question: (q ? q[1] : file.replace(/\.md$/, '')).trim(),
		context: (c ? c[1] : '').trim(),
	};
}

export function delete_pending(file) {
	const fp = join(fs.pending(), file);
	if (existsSync(fp)) unlinkSync(fp);
}

export function list_con_files() {
	if (!existsSync(fs.conclusions())) return [];
	return readdirSync(fs.conclusions()).filter(f => f.endsWith('.md') && !f.startsWith('README') && !f.startsWith('_'));
}


export function find_isolated(n = 20) {
	return list_con_files()
		.filter(f => {
			const text = readFileSync(join(fs.conclusions(), f), 'utf8');
			return !text.includes('[[') && !text.includes('## Research');
		})
		.slice(0, n);
}


export function extract_files_from_graph(graphText) {
	if (!graphText) return [];
	return [...graphText.matchAll(/^NODE\s+(.+?)\.md\s+\[/gm)]
		.map(m => m[1].trim());
}

const RS = '<!-- related:start -->';
const RE = '<!-- related:end -->';

export function patch_related(filePath, links) {
	let content = readFileSync(filePath, 'utf8');
	const block = links.length
		? `${RS}\n## Related\n${links.map(t => `- [[${t}]]`).join('\n')}\n${RE}`
		: '';
	const re = new RegExp(`${RS}[\\s\\S]*?${RE}`, 'g');
	content = re.test(content) ? content.replace(re, block)
		: block ? content.trimEnd() + '\n\n' + block + '\n' : content;
	writeFileSync(filePath, content);
}

export function patch_frontmatter_sources(filePath, sources) {
	let content = readFileSync(filePath, 'utf8');
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const value = sources.length
		? `sources:\n${sources.map(s => `  - "[[${safe_link(s)}]]"`).join('\n')}`
		: '';
	if (fm) {
		let body = fm[1].replace(/^sources:(\n[ \t]+[^\n]*)*/m, '').replace(/\n{2,}/g, '\n').trimEnd();
		if (value) body += '\n' + value;
		content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${body.trim()}\n---`);
	} else {
		if (value) content = `---\n${value}\n---\n\n` + content;
	}
	writeFileSync(filePath, content);
}

export function patch_frontmatter_related(filePath, links) {
	let content = readFileSync(filePath, 'utf8');
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const value = links.length
		? `related:\n${links.map(t => `  - "[[${safe_link(t)}]]"`).join('\n')}`
		: '';
	if (fm) {
		// Remove existing related: block (key + all indented list lines below it)
		let body = fm[1].replace(/^related:(\n[ \t]+[^\n]*)*/m, '').replace(/\n{2,}/g, '\n').trimEnd();
		if (value) body += '\n' + value;
		content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${body.trim()}\n---`);
	} else {
		if (value) content = `---\n${value}\n---\n\n` + content;
	}
	writeFileSync(filePath, content);
}
