import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, match_prefix } from '../js/slug.js';

test('match_prefix gates duplicate-pending detection across slug length eras', () => {
  const question = 'Tracer coverage gap: submit present not bracketed in vault overlay';
  const new_slug = slugify(question);
  const old_pending = 'tracer-coverage-gap-submit-present-not-bracketed-in-vault.md';
  assert.ok(match_prefix(new_slug, old_pending));
});
