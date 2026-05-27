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
  if (s.length > SLUG_MAX) s = s.slice(0, SLUG_MAX);
  s = s.replace(/-+$/, '');
  return s;
}
