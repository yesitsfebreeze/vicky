/**
 * tag-context.js — scan conclusion notes for tags matching the user prompt,
 * and render a context block to inject into the answer.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse_fm_list } from '../vault.js';
import * as fs from '../fs.js';

// ── tunables ─────────────────────────────────────────────────────────────────────────────────

export const MAX_TAGS    = 5;
export const MAX_NOTES   = 3;
export const SNIPPET_LEN = 150;

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

/** Escape all regex-special chars so a tag is matched literally. */
function escape_re(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Return the first non-empty, non-heading body line after frontmatter. */
function extract_snippet(content) {
	const lines = content.replace(/^\uFEFF/, '').split('\n');
	let in_fm     = false;
	let fm_closed = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (i === 0 && line.trimEnd() === '---') { in_fm = true; continue; }
		if (in_fm && line.trimEnd() === '---')   { fm_closed = true; continue; }
		if (!fm_closed) continue;
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		return t.length > SNIPPET_LEN ? t.slice(0, SNIPPET_LEN) + '…' : t;
	}
	return '';
}

// ── public API ────────────────────────────────────────────────────────────────────────────────

/**
 * Recursively walk `dir`, parse each .md file's tags and title, and
 * return a Map<tag, Array<{title, slug, snippet}>> in first-seen tag order.
 * Skips entries (files and dirs) whose name starts with '.'.
 * If `dir` does not exist, returns an empty Map.
 */
export function collect_tags(dir = fs.conclusions()) {
	const tagMap = new Map();
	if (!existsSync(dir)) return tagMap;

	function walk(d) {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			if (entry.name.startsWith('.')) continue;
			const full = join(d, entry.name);
			if (entry.isDirectory()) { walk(full); continue; }
			if (!entry.name.endsWith('.md')) continue;

			const content = readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
			const slug    = entry.name.replace(/\.md$/, '');
			const path    = full.replace(/\\/g, '/');
			const titles  = parse_fm_list(content, 'title');
			const title   = titles[0] || slug;
			const tags    = parse_fm_list(content, 'tags');
			const snippet = extract_snippet(content);

			for (const tag of tags) {
				if (!tagMap.has(tag)) tagMap.set(tag, []);
				tagMap.get(tag).push({ title, slug, path, snippet });
			}
		}
	}

	walk(dir);
	return tagMap;
}

/**
 * Return tags from tagMap whose length is >= 3 AND that appear as a whole
 * word (case-insensitive) in `prompt`. Regex-special chars are escaped so
 * e.g. 'node.js' or 'c++' are matched literally.
 * Result preserves tagMap insertion order.
 */
export function match_prompt(prompt, tagMap) {
	const matched = [];
	for (const tag of tagMap.keys()) {
		if (tag.length < 3) continue;
		const esc = escape_re(tag);
		// Non-alphanumeric boundaries: \b only covers \w edges.
		const re  = new RegExp('(?<![\\w])' + esc + '(?![\\w])', 'i');
		if (re.test(prompt)) matched.push(tag);
	}
	return matched;
}

/**
 * Render a markdown context block from matched tags and the full tagMap.
 * Returns '' when matchedTags is empty.
 * Caps at MAX_TAGS tags; MAX_NOTES notes per tag; dedupes across tags by slug.
 */
export function render(matchedTags, tagMap) {
	if (!matchedTags || !matchedTags.length) return '';

	const capped   = matchedTags.slice(0, MAX_TAGS);
	const seen     = new Set();
	const sections = [];

	for (const tag of capped) {
		const notes = tagMap.get(tag) || [];
		const lines = [];
		for (const note of notes) {
			if (lines.length >= MAX_NOTES) break;
			if (seen.has(note.slug)) continue;
			seen.add(note.slug);
			const snip = note.snippet ? ': ' + note.snippet : '';
			lines.push(`- @${note.path} — ${note.title}${snip}`);
		}
		if (lines.length) {
			sections.push(`### #${tag}\n${lines.join('\n')}`);
		}
	}

	if (!sections.length) return '';

	const header = `## Vicky KB (live) — conclusions tagged: ${capped.join(', ')}`;
	const footer = '> Live from the vault. Need more? Run /vicky:query "<topic>".';
	return [header, '', ...sections, '', footer].join('\n');
}

/**
 * Convenience: run match_prompt then render.
 * Returns '' when nothing matches.
 */
export function build_context(prompt, tagMap) {
	return render(match_prompt(prompt, tagMap), tagMap);
}
