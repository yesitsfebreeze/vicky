// Canonical slug producer. Idempotent: slugify(slugify(x)) === slugify(x).
// 45-char cap balances readability against Windows MAX_PATH headroom.
// Applied EVERYWHERE a slug is produced — mint, emit, lookup-normalization,
// frontmatter rewrite. No second slugifier exists.
export const SLUG_MAX = 45;

export function slugify(input) {
  if (input == null) return '';
  let s = String(input).replace(/\.md$/i, '');
  s = s.replace(/[^\w\s-]/g, '');
  s = s.trim().replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-/, '');
  if (s.length > SLUG_MAX) s = s.slice(0, SLUG_MAX);
  s = s.replace(/-+$/, '');
  return s;
}

// Bidirectional case-insensitive start-of-string match. Returns true if
// either argument is a prefix of the other (after .md stripping). Bridges
// the era gap between legacy 60-char filenames (pre-0.9.1) and 45-char slugs.
export function match_prefix(slug, candidate) {
  if (!slug || !candidate) return false;
  const a = String(slug).replace(/\.md$/i, '').toLowerCase();
  const b = String(candidate).replace(/\.md$/i, '').toLowerCase();
  if (!a || !b) return false;
  return a.startsWith(b) || b.startsWith(a);
}
