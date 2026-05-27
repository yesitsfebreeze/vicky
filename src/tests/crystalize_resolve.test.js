import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve_slug } from '../js/slug.js';

test('resolve_slug works against a conclusions-shaped fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'vicky-conc-'));
  const file = 'tracer-coverage-gap-submit-present-not-bracketed.md';
  writeFileSync(join(root, file), '---\ntitle: test\n---\n');
  const hit = resolve_slug('tracer-coverage-gap-submit-present-not-bracke', root);
  assert.equal(hit, join(root, file));
  rmSync(root, { recursive: true });
});

import { slugify, match_prefix } from '../js/slug.js';

test('match_prefix bridges 45-char input slug to 60-char on-disk basename', () => {
  const input_slug = slugify('Tracer Coverage Gap: Submit Present Not Bracketed Or Foo Bar');
  const on_disk = 'tracer-coverage-gap-submit-present-not-bracketed-or-foo';
  assert.ok(match_prefix(input_slug, on_disk));
});
