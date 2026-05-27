import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../js/slug.js';

test('slugify normalizes graphify NODE stems with stray punctuation', () => {
  assert.equal(slugify('Some Node: With Punctuation!'), 'Some-Node-With-Punctuation');
});
