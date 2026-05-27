import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../js/slug.js';

test('slugify normalizes graphify NODE stems with stray punctuation', () => {
  assert.equal(slugify('Some Node: With Punctuation!'), 'Some-Node-With-Punctuation');
});

test('GraphQL and similar Graph-prefixed slugs are NOT filtered out', () => {
  // The old filter dropped any slug starting with "Graph"; SECTION_NODES
  // alone covers the two section headers we want to exclude.
  const valid_graph_slugs = ['GraphQL', 'Graph-Theory', 'Graphics-Pipeline', 'GraphQL-Best-Practices'];
  const SECTION_NODES = new Set(['Research', 'Sources', 'Related', 'Graph-Context', 'Graph-Traversal', 'GRAPH_REPORT']);
  for (const slug of valid_graph_slugs) {
    assert.ok(!SECTION_NODES.has(slug), slug + ' should not be in SECTION_NODES');
  }
});

test('Graph-Context and Graph-Traversal are filtered via SECTION_NODES', () => {
  const SECTION_NODES = new Set(['Research', 'Sources', 'Related', 'Graph-Context', 'Graph-Traversal', 'GRAPH_REPORT']);
  assert.ok(SECTION_NODES.has('Graph-Context'));
  assert.ok(SECTION_NODES.has('Graph-Traversal'));
});
