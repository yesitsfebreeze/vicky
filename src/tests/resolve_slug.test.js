import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve_slug } from '../js/slug.js';

function make_fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'vicky-resolve-'));
  for (const rel of files) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '');
  }
  return root;
}

test('exact match', () => {
  const root = make_fixture(['foo-bar.md']);
  assert.equal(resolve_slug('foo-bar', root), join(root, 'foo-bar.md'));
  rmSync(root, { recursive: true });
});

test('45-char query finds 60-char legacy file', () => {
  const slug45 = 'tracer-coverage-gap-submit-present-not-bracke';
  const file60 = 'tracer-coverage-gap-submit-present-not-bracketed-or-foo.md';
  const root = make_fixture([file60]);
  assert.equal(resolve_slug(slug45, root), join(root, file60));
  rmSync(root, { recursive: true });
});

test('60-char query finds 45-char legacy file', () => {
  const slug60 = 'tracer-coverage-gap-submit-present-not-bracketed-or-foo';
  const file45 = 'tracer-coverage-gap-submit-present-not-bracke.md';
  const root = make_fixture([file45]);
  assert.equal(resolve_slug(slug60, root), join(root, file45));
  rmSync(root, { recursive: true });
});

test('walks subdirectories', () => {
  const root = make_fixture(['perf/foo-bar.md']);
  assert.equal(resolve_slug('foo-bar', root), join(root, 'perf', 'foo-bar.md'));
  rmSync(root, { recursive: true });
});

test('skips dotdirs (e.g. .absorbed/)', () => {
  const root = make_fixture(['.absorbed/foo-bar.md', 'live/foo-bar.md']);
  assert.equal(resolve_slug('foo-bar', root), join(root, 'live', 'foo-bar.md'));
  rmSync(root, { recursive: true });
});

test('returns null when nothing matches', () => {
  const root = make_fixture(['unrelated.md']);
  assert.equal(resolve_slug('foo-bar', root), null);
  rmSync(root, { recursive: true });
});

test('prefers exact match over prefix match', () => {
  const root = make_fixture(['foo-bar-baz.md', 'foo-bar.md']);
  assert.equal(resolve_slug('foo-bar', root), join(root, 'foo-bar.md'));
  rmSync(root, { recursive: true });
});

test('returns null for non-existent dir', () => {
  assert.equal(resolve_slug('foo', '/does/not/exist'), null);
});

test('normalizes input via slugify (strips special chars)', () => {
  const root = make_fixture(['Hello-World.md']);
  assert.equal(resolve_slug('Hello World!', root), join(root, 'Hello-World.md'));
  rmSync(root, { recursive: true });
});
