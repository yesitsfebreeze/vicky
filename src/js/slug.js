// Canonical slug producer. Idempotent: slugify(slugify(x)) === slugify(x).
// 45-char cap balances readability against Windows MAX_PATH headroom.
// Applied EVERYWHERE a slug is produced — mint, emit, lookup-normalization,
// frontmatter rewrite. No second slugifier exists.
export const SLUG_MAX = 45;

export function slugify(input) {
  if (input == null) return '';
  let s = String(input).replace(/\.md$/i, '');
  s = s.replace(/_/g, '-');
  s = s.replace(/[^\w\s-]/g, '');
  s = s.trim().replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-/, '');
  if (s.length > SLUG_MAX) s = s.slice(0, SLUG_MAX);
  s = s.replace(/-+$/, '');
  return s;
}

// Bidirectional case-insensitive start-of-string match. Returns true if
// either argument is a prefix of the other (after slug normalization
// (underscores→dashes, .md stripped, 45-char cap)). Bridges the era gap
// between legacy 60-char filenames (pre-0.9.1) and 45-char slugs.
export function match_prefix(slug, candidate) {
  if (!slug || !candidate) return false;
  const a = slugify(slug).toLowerCase();
  const b = slugify(candidate).toLowerCase();
  if (!a || !b) return false;
  return a.startsWith(b) || b.startsWith(a);
}

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Walk `dir` recursively, return absolute path of first basename matching
// `stem` via match_prefix. Exact matches beat prefix matches. Dotdirs and
// dotfiles are skipped. Returns null if dir missing or no hit.
export function resolve_slug(stem, dir) {
  if (!dir || !existsSync(dir)) return null;
  const target = slugify(stem);
  if (!target) return null;

  let exact = null;
  let prefix = null;

  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      const base = slugify(e.name);
      if (base.toLowerCase() === target.toLowerCase()) { exact = full; break; }
      if (!prefix && match_prefix(target, base)) { prefix = full; }
    }
    if (exact) break;
  }
  return exact ?? prefix;
}
