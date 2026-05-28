import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	collect_tags,
	match_prompt,
	render,
	build_context,
	MAX_TAGS,
	MAX_NOTES,
	SNIPPET_LEN,
} from '../js/hooks/tag-context.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function make_note({ slug, title, tags, body = 'Body line one.' }) {
	return `---\ntitle: ${title}\ndate: 2026-05-28\ntype: conclusion\ntags: [${tags.join(', ')}]\n---\n\n# ${title}\n\n${body}\n`;
}

// ── match_prompt ──────────────────────────────────────────────────────────────

test('match_prompt: whole-word boundary — perf does NOT match "performance"', () => {
	const map = new Map([['perf', []]]);
	assert.deepEqual(match_prompt('improving performance', map), []);
});

test('match_prompt: whole-word boundary — perf does NOT match "imperfect"', () => {
	const map = new Map([['perf', []]]);
	assert.deepEqual(match_prompt('imperfect solution', map), []);
});

test('match_prompt: whole-word boundary — perf DOES match "perf"', () => {
	const map = new Map([['perf', []]]);
	assert.deepEqual(match_prompt('perf', map), ['perf']);
});

test('match_prompt: whole-word boundary — perf DOES match inside sentence', () => {
	const map = new Map([['perf', []]]);
	assert.deepEqual(match_prompt("how's perf?", map), ['perf']);
});

test('match_prompt: case-insensitive — Perf matches tag "perf"', () => {
	const map = new Map([['perf', []]]);
	assert.deepEqual(match_prompt('Perf is important', map), ['perf']);
});

test('match_prompt: tags shorter than 3 chars are skipped', () => {
	const map = new Map([['go', []], ['js', []], ['api', []]]);
	assert.deepEqual(match_prompt('go js api', map), ['api']);
});

test('match_prompt: regex-special tag node.js matched literally', () => {
	const map = new Map([['node.js', []]]);
	assert.deepEqual(match_prompt('using node.js here', map), ['node.js']);
});

test('match_prompt: regex-special tag node.js does NOT match "nodejs"', () => {
	const map = new Map([['node.js', []]]);
	assert.deepEqual(match_prompt('nodejs is cool', map), []);
});

test('match_prompt: regex-special tag c++ matched literally', () => {
	const map = new Map([['c++', []]]);
	assert.deepEqual(match_prompt('written in c++', map), ['c++']);
});

test('match_prompt: preserves tagMap insertion order', () => {
	const map = new Map([['gpu', []], ['perf', []], ['cache', []]]);
	const result = match_prompt('perf gpu cache tuning', map);
	assert.deepEqual(result, ['gpu', 'perf', 'cache']);
});

// ── render ────────────────────────────────────────────────────────────────────

test('render: returns empty string for empty matchedTags', () => {
	assert.equal(render([], new Map()), '');
	assert.equal(render(null, new Map()), '');
});

test('render: footer hint line is present when there is >= 1 match', () => {
	const map = new Map([['perf', [{ slug: 'note-a', title: 'Note A', snippet: 'snippet' }]]]);
	const out = render(['perf'], map);
	assert.ok(out.includes('/vicky:research'), `footer missing in:\n${out}`);
});

test('render: MAX_TAGS cap — only 5 tags rendered when 6 are matched', () => {
	const tags = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'];
	const map  = new Map(tags.map((t, i) => [t, [{ slug: `note-${i}`, title: `Note ${i}`, snippet: '' }]]));
	const out  = render(tags, map);
	// Should contain headers for first 5 only
	assert.ok(out.includes('### #aaa'), 'missing aaa');
	assert.ok(out.includes('### #eee'), 'missing eee');
	assert.ok(!out.includes('### #fff'), 'fff should be capped');
});

test('render: MAX_NOTES cap — only 3 notes rendered when 4 exist for a tag', () => {
	const notes = [
		{ slug: 'n1', title: 'Note 1', snippet: '' },
		{ slug: 'n2', title: 'Note 2', snippet: '' },
		{ slug: 'n3', title: 'Note 3', snippet: '' },
		{ slug: 'n4', title: 'Note 4', snippet: '' },
	];
	const map = new Map([['perf', notes]]);
	const out = render(['perf'], map);
	assert.ok(out.includes('[[n3]]'), 'should include n3');
	assert.ok(!out.includes('[[n4]]'), 'n4 should be capped');
});

test('render: cross-tag deduplication by slug — note under both perf and gpu shows only under first', () => {
	const shared = { slug: 'shared-note', title: 'Shared', snippet: 'shared body' };
	const gpu_only = { slug: 'gpu-only', title: 'GPU Only', snippet: '' };
	const map = new Map([
		['perf', [shared]],
		['gpu',  [shared, gpu_only]],
	]);
	const out = render(['perf', 'gpu'], map);
	// shared-note should appear exactly once
	const count = (out.match(/shared-note/g) || []).length;
	assert.equal(count, 1, `shared-note appears ${count} times`);
	// gpu-only should still appear
	assert.ok(out.includes('gpu-only'), 'gpu-only should appear');
});

test('render: snippet truncation appends ellipsis past SNIPPET_LEN', () => {
	const long = 'x'.repeat(SNIPPET_LEN + 10);
	const note = { slug: 'trunc', title: 'Trunc', snippet: long.slice(0, SNIPPET_LEN) + '…' };
	const map  = new Map([['perf', [note]]]);
	const out  = render(['perf'], map);
	assert.ok(out.includes('…'), `ellipsis missing in: ${out}`);
});

test('render: header names the matched tags', () => {
	const map = new Map([['perf', [{ slug: 'n1', title: 'T', snippet: '' }]]]);
	const out = render(['perf'], map);
	assert.ok(out.startsWith('## Vicky KB (live) — conclusions tagged: perf'), `bad header:\n${out}`);
});

// ── collect_tags ──────────────────────────────────────────────────────────────

test('collect_tags: returns empty Map for missing directory', async () => {
	const result = collect_tags('/tmp/__definitely_does_not_exist_vicky_test__');
	assert.equal(result.size, 0);
});

test('collect_tags: parses .md files and builds tag map', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'vicky-tc-'));
	try {
		writeFileSync(join(tmp, 'gpu-perf.md'), make_note({
			slug: 'gpu-perf',
			title: 'GPU perf tuning',
			tags: ['perf', 'gpu'],
			body: 'The first prose line of the body.',
		}));
		writeFileSync(join(tmp, 'shader-cache.md'), make_note({
			slug: 'shader-cache',
			title: 'Shader cache',
			tags: ['gpu', 'cache'],
			body: 'Shader cache speeds up compilation.',
		}));

		const map = collect_tags(tmp);
		assert.ok(map.has('perf'), 'missing perf tag');
		assert.ok(map.has('gpu'),  'missing gpu tag');
		assert.ok(map.has('cache'), 'missing cache tag');

		const perf_notes = map.get('perf');
		assert.equal(perf_notes.length, 1);
		assert.equal(perf_notes[0].slug, 'gpu-perf');
		assert.equal(perf_notes[0].title, 'GPU perf tuning');
		assert.ok(perf_notes[0].snippet.includes('The first prose line'), `bad snippet: ${perf_notes[0].snippet}`);

		const gpu_notes = map.get('gpu');
		assert.equal(gpu_notes.length, 2, 'gpu should have 2 notes');
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

test('collect_tags: snippet skips heading lines and picks first prose line', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'vicky-tc-snip-'));
	try {
		const content = `---\ntitle: Test Note\ndate: 2026-05-28\ntype: conclusion\ntags: [foo]\n---\n\n# Test Note\n\n## Subheading\n\nActual prose here.\n`;
		writeFileSync(join(tmp, 'test-note.md'), content);
		const map = collect_tags(tmp);
		const notes = map.get('foo');
		assert.ok(notes, 'missing foo tag');
		assert.equal(notes[0].snippet, 'Actual prose here.', `got snippet: ${notes[0].snippet}`);
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

test('collect_tags: snippet is truncated and ends with ellipsis when over SNIPPET_LEN', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'vicky-tc-trunc-'));
	try {
		const longBody = 'word '.repeat(60).trim();
		const content = `---\ntitle: Long Note\ndate: 2026-05-28\ntype: conclusion\ntags: [longtest]\n---\n\n${longBody}\n`;
		writeFileSync(join(tmp, 'long-note.md'), content);
		const map = collect_tags(tmp);
		const notes = map.get('longtest');
		assert.ok(notes, 'missing longtest tag');
		const snip = notes[0].snippet;
		assert.ok(snip.endsWith('…'), `snippet should end with ellipsis, got: ${snip}`);
		assert.ok(snip.length <= SNIPPET_LEN + 1, `snippet too long: ${snip.length}`);
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

test('collect_tags: dotfile (.hidden.md) is skipped', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'vicky-tc-dot-'));
	try {
		writeFileSync(join(tmp, '.hidden.md'), make_note({
			slug: '.hidden',
			title: 'Hidden',
			tags: ['secret'],
			body: 'Should be ignored.',
		}));
		writeFileSync(join(tmp, 'visible.md'), make_note({
			slug: 'visible',
			title: 'Visible',
			tags: ['public'],
			body: 'Should be indexed.',
		}));
		const map = collect_tags(tmp);
		assert.ok(!map.has('secret'), 'dotfile should be skipped');
		assert.ok(map.has('public'), 'visible file should be indexed');
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

test('collect_tags: dot-directory (.obsidian/) is skipped', async () => {
	const tmp    = mkdtempSync(join(tmpdir(), 'vicky-tc-dotdir-'));
	const dotDir = join(tmp, '.obsidian');
	try {
		mkdirSync(dotDir);
		writeFileSync(join(dotDir, 'inside.md'), make_note({
			slug: 'inside',
			title: 'Inside',
			tags: ['hidden'],
			body: 'Inside dot dir.',
		}));
		const map = collect_tags(tmp);
		assert.ok(!map.has('hidden'), 'dot-directory content should be skipped');
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

test('collect_tags: filename stem used as title when frontmatter has no title', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'vicky-tc-notitle-'));
	try {
		const content = `---\ndate: 2026-05-28\ntype: conclusion\ntags: [notitle]\n---\n\nBody here.\n`;
		writeFileSync(join(tmp, 'my-note.md'), content);
		const map = collect_tags(tmp);
		const notes = map.get('notitle');
		assert.ok(notes, 'missing notitle tag');
		assert.equal(notes[0].title, 'my-note', `expected stem fallback, got: ${notes[0].title}`);
	} finally {
		rmSync(tmp, { recursive: true });
	}
});

// ── build_context ─────────────────────────────────────────────────────────────

test('build_context: returns empty string when no tags match', () => {
	const map = new Map([['perf', [{ slug: 'n', title: 'N', snippet: '' }]]]);
	assert.equal(build_context('unrelated topic here', map), '');
});

test('build_context: returns rendered block when tags match', () => {
	const map = new Map([['perf', [{ slug: 'n', title: 'N', snippet: 'snap' }]]]);
	const out = build_context('perf tips', map);
	assert.ok(out.includes('[[n]]'), `block missing note:\n${out}`);
});