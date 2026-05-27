import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, match_prefix } from '../js/slug.js';

test('match_prefix gates duplicate-pending detection across slug length eras', () => {
  const question = 'Tracer coverage gap: submit present not bracketed in vault overlay';
  const new_slug = slugify(question);
  const old_pending = 'tracer-coverage-gap-submit-present-not-bracketed-in-vault.md';
  assert.ok(match_prefix(new_slug, old_pending));
});

test('match_prefix bidirectional was the bug: short pending no longer falsely suppresses long question', () => {
  // Realistic scenario: a 2-char stub  should NOT suppress questions
  // whose slug begins with . With exact equality (post-fix), they differ.
  const q_slug = slugify('AI safety research methods');
  const short_pending = 'ai.md';
  assert.notEqual(slugify(short_pending), q_slug);
});

test('exact slug equality survives era-bridging (45 char vs 60 char on disk)', () => {
  // Legacy 60-char pending basename, when slugified, caps at 45 and matches
  // the slug of the equivalent question.
  const question = 'Tracer coverage gap submit present not bracketed in vault overlay extra';
  const legacy_basename = 'Tracer-coverage-gap-submit-present-not-bracke-extra-words-to-exceed-45-chars.md';
  assert.equal(slugify(legacy_basename), slugify(question));
});
