import { existsSync, readFileSync, readdirSync } from "./fs-wrapper.js";
import { join } from "path";
import { patch_frontmatter_related } from "./vault.js";
import { query_graph } from "./graph.js";
import { slugify } from "./slug.js";
if (!patch_frontmatter_related) {
  throw new Error("patch_frontmatter_related import failed");
}
if (!query_graph) {
  throw new Error("query_graph import failed");
}
if (!existsSync) {
  throw new Error("fs-wrapper imports failed");
}
const BATCH = 10;
function list_md_files(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) files.push({ full, name: e.name });
    }
  }
  walk(dir);
  return files;
}
const SECTION_NODES = /* @__PURE__ */ new Set(["Research", "Sources", "Related", "Graph-Context", "Graph-Traversal", "GRAPH-REPORT"]);
function parse_related(raw, selfName) {
  const self_slug = slugify(selfName);
  return [...(raw ?? "").matchAll(/^NODE\s+(.+?)\s+\[/gm)].map((m) => slugify(m[1])).filter((t) => t && t !== self_slug && !SECTION_NODES.has(t) && !t.startsWith("code:"));
}
async function relink_dir(dir, graphPath, notify = null) {
  const files = list_md_files(dir);
  let patched = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(files.slice(i, i + BATCH).map(async ({ full, name }) => {
      try {
        const stem = name.replace(/\.md$/, "");
        const raw = await query_graph(stem, graphPath);
        const links = parse_related(raw, stem);
        if (links.length) {
          if (typeof patch_frontmatter_related !== "function") {
            throw new Error(`patch_frontmatter_related is not a function: ${typeof patch_frontmatter_related}`);
          }
          patch_frontmatter_related(full, links);
          patched++;
        }
      } catch (err) {
        console.error(`[vicky-link] Error in relink for ${name}:`, err.message);
        throw err;
      }
    }));
  }
  return { total: files.length, patched };
}
export {
  relink_dir
};
