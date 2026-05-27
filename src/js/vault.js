import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';


export function search_hits(dir, query, limit = 10) {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return [];
	const root = fs.root();
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
			const matched = terms.filter(t => lower.includes(t)).length;
			if (!matched) continue;
			const lines = text.split('\n');
			const idx = lines.findIndex(l => terms.some(t => l.toLowerCase().includes(t)));
			const snippet = lines.slice(Math.max(0, idx - 1), idx + 5).join('\n').slice(0, 200);
			const coverage = matched / terms.length;
			const position = idx < 0 ? 0 : 1 / (1 + idx / 10);
			const score = +(coverage * 0.6 + position * 0.4).toFixed(4);
			const rel = full.replace(/\\/g, '/');
			const note_path = rel.startsWith(root.replace(/\\/g, '/') + '/') ? rel : `${root}/${rel}`.replace(/\\/g, '/');
			hits.push({ note_path, score, inlinks: 0, snippet });
		}
	}
	walk(dir);
	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, limit);
}

const safe_name = t => t.replace(/[^\w\s-]/g, '').trim().slice(0, 45).replace(/\s+/g, '-');

function strip_section(body, heading) {
	const re = new RegExp(`\\n{0,2}##\\s+${heading}\\s*\\n(?:[^\\n]*\\n?)*?(?=\\n##\\s|$)`, 'g');
	return body.replace(re, '').trimEnd();
}

function regen_body_sections(body, sources, related) {
	let out = body;
	out = strip_section(out, 'Sources');
	out = strip_section(out, 'Related');
	return out;
}

function frontmatter_links(key, items) {
	if (!items?.length) return '';
	return `\n${key}:\n${items.map(t => `  - "[[${safe_name(t)}]]"`).join('\n')}`;
}

export function gen_source_id(dir = fs.sources()) {
	const d = new Date();
	const yy = String(d.getFullYear()).slice(-2);
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const stamp = `${yy}${mm}${dd}`;
	mkdirSync(dir, { recursive: true });
	for (let i = 0; i < 100; i++) {
		const hex = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
		const id = `${stamp}-${hex}`;
		if (!existsSync(join(dir, `${id}.md`))) return id;
	}
	throw new Error(`gen_source_id: 100 collisions in ${dir}`);
}

function yaml_title(title) {
	if (/[:"]/.test(title)) return `"${title.replace(/"/g, '\\"')}"`;
	return title;
}

export function save_note(title, body, { dir = fs.sources(), tags = [], type = 'source', sources = [], related = [], id_filename = false } = {}) {
	const date = new Date().toISOString().split('T')[0];
	mkdirSync(dir, { recursive: true });
	let path, title_field;
	if (id_filename) {
		const id = gen_source_id(dir);
		path = join(dir, `${id}.md`);
		title_field = yaml_title(title);
	} else {
		const safe = safe_name(title);
		path = join(dir, `${safe}.md`);
		title_field = safe;
	}
	const frontmatter = [
		`title: ${title_field}`,
		`date: ${date}`,
		`type: ${type}`,
		`tags: [${tags.join(', ')}]`,
	].join('\n')
		+ frontmatter_links('sources', sources)
		+ frontmatter_links('related', related);
	const body_with_links = regen_body_sections(body, sources, related);
	writeFileSync(path, `---\n${frontmatter}\n---\n\n${body_with_links}\n`);
	return path;
}

export function enqueue_research(question, { context = '', requested_by = '', priority = 'med', sources = [] } = {}) {
	const date = new Date().toISOString().split('T')[0];
	const safe = safe_name(question);
	mkdirSync(fs.pending(), { recursive: true });
	const path = join(fs.pending(), `${safe}.md`);
	if (existsSync(path)) return path;
	const frontmatter = [
		`title: ${safe}`,
		`date: ${date}`,
		`type: research-pending`,
		`status: pending`,
		`requested_by: ${requested_by}`,
		`priority: ${priority}`,
		`tags: [research, pending]`,
	].join('\n') + frontmatter_links('sources', sources);
	const body = `---\n${frontmatter}\n---\n\n## Question\n${question}\n\n## Context\n${context}\n`;
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
	const s = text.match(/## Sources\s*\n([\s\S]*?)(?=\n## |$)/);
	const fm_sources = [...text.matchAll(/^\s*-\s*"?\[\[([^\]|]+)\]\]"?/gm)].map(m => m[1].trim());
	const body_sources = s ? [...s[1].matchAll(/\[\[([^\]|]+)\]\]/g)].map(m => m[1].trim()) : [];
	return {
		path: fp,
		question: (q ? q[1] : file.replace(/\.md$/, '')).trim(),
		context: (c ? c[1] : '').trim(),
		sources: [...new Set([...fm_sources, ...body_sources])],
	};
}

export function delete_pending(file) {
	const fp = join(fs.pending(), file);
	if (existsSync(fp)) unlinkSync(fp);
}

export function patch_frontmatter_sources(filePath, sources) {
	let content = readFileSync(filePath, 'utf8');
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const value = sources.length
		? `sources:\n${sources.map(s => `  - "[[${safe_name(s)}]]"`).join('\n')}`
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
		? `related:\n${links.map(t => `  - "[[${safe_name(t)}]]"`).join('\n')}`
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


// --- crystalize support ---

export function absorb_source(name) {
	const slug = name.replace(/\.md$/, '');
	const from = join(fs.sources(), `${slug}.md`);
	const to = join(fs.absorbed(), `${slug}.md`);
	if (!existsSync(from)) throw new Error(`source not found: ${from}`);
	mkdirSync(fs.absorbed(), { recursive: true });
	renameSync(from, to);
	return to;
}

export function parse_fm_list(content, key) {
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return [];
	const lines = fm[1].split('\n');
	const out = [];
	let in_key = false;
	for (const line of lines) {
		if (new RegExp(`^${key}:\\s*$`).test(line)) { in_key = true; continue; }
		if (in_key) {
			const m = line.match(/^\s+-\s*"?\[?\[?([^"\]|\n]+?)\]?\]?"?\s*$/);
			if (m) { out.push(m[1].trim().replace(/\.md$/, '')); continue; }
			if (line.trim() === '' || /^\S/.test(line)) in_key = false;
		}
	}
	return out;
}

export function patch_frontmatter_derived_from(filePath, slugs) {
	let content = readFileSync(filePath, 'utf8');
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const value = slugs.length
		? `derived_from:\n${slugs.map(s => `  - ${safe_name(s)}`).join('\n')}`
		: '';
	if (fm) {
		let body = fm[1].replace(/^derived_from:(\n[ \t]+[^\n]*)*/m, '').replace(/\n{2,}/g, '\n').trimEnd();
		if (value) body += '\n' + value;
		content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${body.trim()}\n---`);
	} else {
		if (value) content = `---\n${value}\n---\n\n` + content;
	}
	writeFileSync(filePath, content);
}
