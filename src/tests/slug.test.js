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
