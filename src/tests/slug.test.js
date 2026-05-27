import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../js/slug.js';

test('slugify: case preserved, special chars stripped', () => {
  assert.equal(slugify('Hello World!'), 'Hello-World');
});

test('slugify: caps at 45 characters', () => {
  assert.equal(slugify('a'.repeat(100)).length, 45);
});

test('slugify: idempotent', () => {
  const s = slugify('Tracer Coverage Gap: Submit Present Not Bracketed Or Foo Bar');
  assert.equal(slugify(s), s);
});

test('slugify: strips .md suffix', () => {
  assert.equal(slugify('foo-bar.md'), 'foo-bar');
});

test('slugify: collapses whitespace, trims edges', () => {
  assert.equal(slugify('  foo   bar  '), 'foo-bar');
});

test('slugify: empty/whitespace input returns empty', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('   '), '');
});

test('slugify: coerces non-string input', () => {
  assert.equal(slugify(null), '');
  assert.equal(slugify(undefined), '');
  assert.equal(slugify(123), '123');
});

test('slugify: no trailing dash after dash-boundary truncation', () => {
  const result = slugify('a'.repeat(44) + ' b');
  assert.ok(!result.endsWith('-'), `got "${result}"`);
});

test('slugify: collapses consecutive dashes from mixed input', () => {
  assert.equal(slugify('foo bar - baz'), 'foo-bar-baz');
});

test('slugify: collapses literal multi-dash runs', () => {
  assert.equal(slugify('foo---bar'), 'foo-bar');
});

test('slugify: strips leading dash', () => {
  assert.equal(slugify('-foo-bar'), 'foo-bar');
});

import { match_prefix } from '../js/slug.js';

test('match_prefix: exact match', () => {
  assert.equal(match_prefix('foo-bar', 'foo-bar'), true);
});

test('match_prefix: slug is prefix of candidate', () => {
  assert.equal(match_prefix('tracer-coverage-gap', 'tracer-coverage-gap-submit-present'), true);
});

test('match_prefix: candidate is prefix of slug', () => {
  assert.equal(match_prefix('tracer-coverage-gap-submit-present', 'tracer-coverage-gap'), true);
});

test('match_prefix: case-insensitive', () => {
  assert.equal(match_prefix('Foo-Bar', 'foo-bar-baz'), true);
});

test('match_prefix: rejects non-prefix substring', () => {
  assert.equal(match_prefix('bar', 'foo-bar'), false);
});

test('match_prefix: empty inputs never match', () => {
  assert.equal(match_prefix('', 'foo'), false);
  assert.equal(match_prefix('foo', ''), false);
  assert.equal(match_prefix('', ''), false);
});

test('match_prefix: strips .md from candidate', () => {
  assert.equal(match_prefix('foo', 'foo-bar.md'), true);
});

import { slugify as vault_slugify } from '../js/vault.js';

test('vault.js re-exports the canonical slugify', () => {
  assert.equal(vault_slugify('Foo Bar!'), 'Foo-Bar');
  assert.equal(vault_slugify('a'.repeat(100)).length, 45);
});

import { search_hits } from '../js/vault.js';
import { mkdtempSync as ms2, writeFileSync as ws2, rmSync as rs2 } from 'node:fs';
import { tmpdir as t2 } from 'node:os';
import { join as j2 } from 'node:path';

test('search_hits: filename prefix scores hit even when body lacks term', () => {
  const root = ms2(j2(t2(), 'vicky-search-'));
  ws2(j2(root, 'tracer-coverage-gap-submit-present.md'), '# unrelated body\n');
  const hits = search_hits(root, 'tracer-coverage-gap-submit', 5);
  assert.ok(hits.length >= 1, `expected hit, got ${hits.length}`);
  assert.ok(hits[0].note_path.endsWith('tracer-coverage-gap-submit-present.md'));
  rs2(root, { recursive: true });
});
test('slugify: underscores normalize to dashes', () => {
  assert.equal(slugify('foo_bar_baz'), 'foo-bar-baz');
});

test('slugify: mixed underscores and dashes collapse to single dash', () => {
  assert.equal(slugify('foo_-_bar'), 'foo-bar');
});

test('slugify: underscored input matches dashed input', () => {
  assert.equal(slugify('GRAPH_REPORT'), 'GRAPH-REPORT');
});

test('search_hits: stem-only hit emits filename-match marker, not frontmatter', () => {
  const root = ms2(j2(t2(), 'vicky-search5-'));
  ws2(j2(root, 'neural-network-arch.md'), '---\ntitle: neural-network-arch\ndate: 2026-01-01\ntags: [ml]\n---\n\nunrelated body content\n');
  const hits = search_hits(root, 'neural-network', 5);
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].snippet.startsWith('(filename match:'), `got snippet: ${hits[0].snippet}`);
  rs2(root, { recursive: true });
});
