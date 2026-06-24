import { existsSync, readdirSync, readFileSync } from "../fs-wrapper.js";
import { join } from "path";
import { parse_fm_list } from "../vault.js";
import * as fs from "../paths.js";
const MAX_TAGS = 5;
const MAX_NOTES = 15;
const SNIPPET_LEN = 150;
function escape_re(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extract_snippet(content) {
  const lines = content.replace(/^\uFEFF/, "").split("\n");
  let in_fm = false;
  let fm_closed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.trimEnd() === "---") {
      in_fm = true;
      continue;
    }
    if (in_fm && line.trimEnd() === "---") {
      fm_closed = true;
      continue;
    }
    if (!fm_closed) continue;
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    return t.length > SNIPPET_LEN ? t.slice(0, SNIPPET_LEN) + "\u2026" : t;
  }
  return "";
}
function collect_tags(dir = fs.conclusions()) {
  const tagMap = /* @__PURE__ */ new Map();
  if (!existsSync(dir)) return tagMap;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const content = readFileSync(full, "utf8").replace(/^\uFEFF/, "");
      const slug = entry.name.replace(/\.md$/, "");
      const path = full.replace(/\\/g, "/");
      const titles = parse_fm_list(content, "title");
      const title = titles[0] || slug;
      const tags = parse_fm_list(content, "tags");
      const snippet = extract_snippet(content);
      for (const tag of tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag).push({ title, slug, path, snippet });
      }
    }
  }
  walk(dir);
  return tagMap;
}
function match_prompt(prompt, tagMap) {
  const matched = [];
  for (const tag of tagMap.keys()) {
    if (tag.length < 3) continue;
    const esc = escape_re(tag);
    const re = new RegExp("(?<![\\w])" + esc + "(?![\\w])", "i");
    if (re.test(prompt)) matched.push(tag);
  }
  return matched;
}
function render(matchedTags, tagMap) {
  if (!matchedTags || !matchedTags.length) return "";
  const capped = matchedTags.slice(0, MAX_TAGS);
  const seen = /* @__PURE__ */ new Set();
  const sections = [];
  for (const tag of capped) {
    const notes = tagMap.get(tag) || [];
    const lines = [];
    for (const note of notes) {
      if (lines.length >= MAX_NOTES) break;
      if (seen.has(note.slug)) continue;
      seen.add(note.slug);
      const snip = note.snippet ? ": " + note.snippet : "";
      lines.push(`- @${note.path} \u2014 ${note.title}${snip}`);
    }
    if (lines.length) {
      sections.push(`### #${tag}
${lines.join("\n")}`);
    }
  }
  if (!sections.length) return "";
  const header = `## Vicky KB (live) \u2014 conclusions tagged: ${capped.join(", ")}`;
  const footer = '> Live from the vault. Need more? Run /vicky:query "<topic>".';
  return [header, "", ...sections, "", footer].join("\n");
}
function build_context(prompt, tagMap) {
  return render(match_prompt(prompt, tagMap), tagMap);
}
export {
  MAX_NOTES,
  MAX_TAGS,
  SNIPPET_LEN,
  build_context,
  collect_tags,
  match_prompt,
  render
};
