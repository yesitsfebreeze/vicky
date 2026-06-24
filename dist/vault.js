import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, renameSync } from "./fs-wrapper.js";
import { join, dirname } from "path";
import * as fs from "./paths.js";
import { slugify, resolve_slug, match_prefix } from "./slug.js";
import { slugify as slugify2, resolve_slug as resolve_slug2, match_prefix as match_prefix2 } from "./slug.js";
function search_hits(dir, query, limit = 10) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const root = fs.root();
  const hits = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith(".md")) continue;
      const text = readFileSync(full, "utf8");
      const lower = text.toLowerCase();
      const matched = terms.filter((t) => lower.includes(t)).length;
      const stem = e.name.replace(/\.md$/, "");
      const stem_hit = terms.some((t) => match_prefix(t, stem));
      if (!matched && !stem_hit) continue;
      const lines = text.split("\n");
      let body_start = 0;
      if (lines[0] === "---") {
        const fm_end = lines.findIndex((l, i) => i > 0 && l === "---");
        if (fm_end >= 0) body_start = fm_end + 1;
      }
      const body_lines = lines.slice(body_start);
      const body_idx = body_lines.findIndex((l) => terms.some((t) => l.toLowerCase().includes(t)));
      const idx = body_idx < 0 ? -1 : body_start + body_idx;
      const snippet = idx < 0 ? `(filename match: ${stem})` : lines.slice(Math.max(0, idx - 1), idx + 5).join("\n").slice(0, 200);
      const coverage = matched / terms.length;
      const position = idx < 0 ? 0 : 1 / (1 + idx / 10);
      const stem_bonus = stem_hit ? 0.2 : 0;
      const score = +(coverage * 0.5 + position * 0.3 + stem_bonus).toFixed(4);
      const rel = full.replace(/\\/g, "/");
      const note_path = rel.startsWith(root.replace(/\\/g, "/") + "/") ? rel : `${root}/${rel}`.replace(/\\/g, "/");
      hits.push({ note_path, score, inlinks: 0, snippet });
    }
  }
  walk(dir);
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
function strip_section(body, heading) {
  const re = new RegExp(`\\n{0,2}##\\s+${heading}\\s*\\n(?:[^\\n]*\\n?)*?(?=\\n##\\s|$)`, "g");
  return body.replace(re, "").trimEnd();
}
function regen_body_sections(body, sources, related) {
  let out = body;
  out = strip_section(out, "Sources");
  out = strip_section(out, "Related");
  return out;
}
function frontmatter_links(key, items) {
  if (!items?.length) return "";
  return `
${key}:
${items.map((t) => `  - "[[${slugify(t)}]]"`).join("\n")}`;
}
function gen_source_id(dir = fs.sources()) {
  const d = /* @__PURE__ */ new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const stamp = `${yy}${mm}${dd}`;
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 100; i++) {
    const hex = Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
    const id = `${stamp}-${hex}`;
    if (!existsSync(join(dir, `${id}.md`))) return id;
  }
  throw new Error(`gen_source_id: 100 collisions in ${dir}`);
}
function yaml_title(title) {
  if (/[:"]/.test(title)) return `"${title.replace(/"/g, '\\"')}"`;
  return title;
}
function strip_fm_key(fmBody, key) {
  const re = new RegExp(`^${key}:[^\\n]*(?:\\n[ \\t]+[^\\n]*)*`, "m");
  return fmBody.replace(re, "").replace(/\n{2,}/g, "\n").trimEnd();
}
function patch_fm_list(filePath, key, items, formatter) {
  let content = readFileSync(filePath, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const value = items.length ? formatter(items) : "";
  if (fm) {
    let body = strip_fm_key(fm[1], key);
    if (value) body += "\n" + value;
    content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---
${body.trim()}
---`);
  } else if (value) {
    content = `---
${value}
---

` + content;
  }
  writeFileSync(filePath, content);
}
function save_note(title, body, {
  dir = fs.sources(),
  tags = [],
  type = "source",
  sources = [],
  related = [],
  id_filename = false,
  filename_slug = null
} = {}) {
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  mkdirSync(dir, { recursive: true });
  let path, title_field;
  if (filename_slug) {
    const safe = slugify(filename_slug);
    path = join(dir, `${safe}.md`);
    title_field = yaml_title(title);
  } else if (id_filename) {
    const id = gen_source_id(dir);
    path = join(dir, `${id}.md`);
    title_field = yaml_title(title);
  } else {
    const safe = slugify(title);
    path = join(dir, `${safe}.md`);
    title_field = safe;
  }
  const frontmatter = [
    `title: ${title_field}`,
    `date: ${date}`,
    `type: ${type}`,
    `tags: [${tags.join(", ")}]`
  ].join("\n") + frontmatter_links("sources", sources) + frontmatter_links("related", related) + (type === "conclusion" ? "\nderived_from: []" : "");
  const body_with_links = regen_body_sections(body, sources, related);
  writeFileSync(path, `---
${frontmatter}
---

${body_with_links}
`);
  return path;
}
function enqueue_research(question, { context = "", requested_by = "", priority = "med", sources = [] } = {}) {
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const safe = slugify(question);
  mkdirSync(fs.pending(), { recursive: true });
  const path = join(fs.pending(), `${safe}.md`);
  if (existsSync(path)) return path;
  const frontmatter = [
    `title: ${safe}`,
    `date: ${date}`,
    `type: research-pending`,
    `status: pending`,
    `requested_by: ${requested_by}`,
    `priority: ${priority}`,
    `tags: [research, pending]`
  ].join("\n") + frontmatter_links("sources", sources);
  const body = `---
${frontmatter}
---

## Question
${question}

## Context
${context}
`;
  writeFileSync(path, body);
  return path;
}
function list_pending() {
  if (!existsSync(fs.pending())) return [];
  return readdirSync(fs.pending()).filter((f) => f.endsWith(".md"));
}
function read_pending(file) {
  const fp = join(fs.pending(), file);
  const text = readFileSync(fp, "utf8");
  const q = text.match(/## Question\s*\n([\s\S]*?)(?=\n## |$)/);
  const c = text.match(/## Context\s*\n([\s\S]*?)(?=\n## |$)/);
  const s = text.match(/## Sources\s*\n([\s\S]*?)(?=\n## |$)/);
  const fm_sources = [...text.matchAll(/^\s*-\s*"?\[\[([^\]|]+)\]\]"?/gm)].map((m) => m[1].trim());
  const body_sources = s ? [...s[1].matchAll(/\[\[([^\]|]+)\]\]/g)].map((m) => m[1].trim()) : [];
  return {
    path: fp,
    slug: file.replace(/\.md$/, ""),
    question: (q ? q[1] : file.replace(/\.md$/, "")).trim(),
    context: (c ? c[1] : "").trim(),
    sources: [.../* @__PURE__ */ new Set([...fm_sources, ...body_sources])]
  };
}
function delete_pending(file) {
  const fp = join(fs.pending(), file);
  if (existsSync(fp)) unlinkSync(fp);
}
function patch_frontmatter_sources(filePath, sources) {
  patch_fm_list(
    filePath,
    "sources",
    sources,
    (ss) => `sources:
${ss.map((s) => `  - "[[${slugify(s)}]]"`).join("\n")}`
  );
}
function patch_frontmatter_related(filePath, links) {
  patch_fm_list(
    filePath,
    "related",
    links,
    (ll) => `related:
${ll.map((t) => `  - "[[${slugify(t)}]]"`).join("\n")}`
  );
}
function find_source(name) {
  return resolve_slug(name, fs.sources());
}
function absorb_source(name) {
  const slug = name.replace(/\.md$/, "");
  const from = find_source(slug);
  if (!from) throw new Error(`source not found: ${slug}`);
  const rel = from.slice(fs.sources().length).replace(/^[\\/]+/, "");
  const to = join(fs.absorbed(), rel);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  return to;
}
function parse_fm_list(content, key) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const lines = fm[1].split(/\r?\n/);
  const out = [];
  let in_key = false;
  for (const line of lines) {
    if (new RegExp(`^${key}:\\s*$`).test(line)) {
      in_key = true;
      continue;
    }
    const inline = line.match(new RegExp(`^${key}:\\s*(.+)$`));
    if (inline) {
      const inner = inline[1].trim();
      const bracket = inner.match(/^\[(.*)\]$/);
      if (bracket) {
        bracket[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "").replace(/^\[\[|\]\]$/g, "").replace(/\.md$/, "")).filter(Boolean).forEach((v) => out.push(v));
      } else {
        const w = inner.replace(/^"|"$/g, "").replace(/^\[\[|\]\]$/g, "").replace(/\.md$/, "").trim();
        if (w) out.push(w);
      }
      continue;
    }
    if (in_key) {
      const m = line.match(/^\s+-\s*"?\[?\[?([^"\]|\n]+?)\]?\]?"?\s*$/);
      if (m) {
        out.push(m[1].trim().replace(/\.md$/, ""));
        continue;
      }
      if (line.trim() === "" || /^\S/.test(line)) in_key = false;
    }
  }
  return out;
}
function patch_frontmatter_derived_from(filePath, slugs) {
  patch_fm_list(
    filePath,
    "derived_from",
    slugs,
    (ss) => `derived_from:
${ss.map((s) => `  - ${slugify(s)}`).join("\n")}`
  );
}
export {
  absorb_source,
  delete_pending,
  enqueue_research,
  find_source,
  gen_source_id,
  list_pending,
  match_prefix2 as match_prefix,
  parse_fm_list,
  patch_frontmatter_derived_from,
  patch_frontmatter_related,
  patch_frontmatter_sources,
  read_pending,
  resolve_slug2 as resolve_slug,
  save_note,
  search_hits,
  slugify2 as slugify
};
