#!/usr/bin/env node
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "./fs-wrapper.js";
import { basename } from "path";
import * as fs from "./paths.js";
function from_paths() {
  const r = fs.root().replace(/\\/g, "/").replace(/\/+$/, "");
  const join_q = (folder) => r === "" || r === "." ? `"${folder}"` : `"${r}/${folder}"`;
  const all = r === "" || r === "." ? `"."` : `"${r}"`;
  return {
    all,
    sources: join_q("sources"),
    conclusions: join_q("conclusions"),
    pending: join_q("pending"),
    hubs_scope: `${join_q("conclusions")} OR ${join_q("sources")}`
  };
}
function build_queries() {
  const p = from_paths();
  const conclusions_prefix = p.conclusions.slice(1, -1);
  return {
    counts: `TABLE WITHOUT ID type AS Type, length(rows) AS Count FROM ${p.all} WHERE type GROUP BY type SORT length(rows) DESC`,
    recent: `TABLE file.folder AS Folder, type, date, tags FROM ${p.all} WHERE date AND date(date) >= date(today) - dur(14 days) SORT date DESC LIMIT 25`,
    hubs: `TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks, length(file.outlinks) AS Outlinks, type FROM ${p.hubs_scope} WHERE length(file.inlinks) > 0 SORT length(file.inlinks) DESC LIMIT 20`,
    pending: `TABLE WITHOUT ID file.link AS Question, priority, requested_by, date FROM ${p.pending} WHERE status = "pending" SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC, date ASC`,
    awaiting_synthesis: `TABLE WITHOUT ID file.link AS Source, length(file.inlinks) AS Inlinks, date FROM ${p.sources} WHERE length(filter(file.inlinks, (l) => startswith(meta(l).path, "${conclusions_prefix}"))) = 0 SORT length(file.inlinks) DESC, date DESC LIMIT 25`,
    orphans: `LIST FROM ${p.hubs_scope} WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0 LIMIT 25`,
    stale: `TABLE WITHOUT ID file.link AS Conclusion, length(file.inlinks) AS Inlinks, date FROM ${p.conclusions} WHERE date AND date(date) < date(today) - dur(60 days) AND length(file.inlinks) < 2 SORT date ASC LIMIT 20`,
    stale_sources: `TABLE WITHOUT ID file.link AS Source, length(file.inlinks) AS Inlinks, date FROM ${p.sources} WHERE date AND date(date) < date(today) - dur(90 days) AND length(file.inlinks) > 0 SORT date ASC LIMIT 20`,
    tags: `TABLE WITHOUT ID tag AS Tag, length(rows) AS Count FROM ${p.all} FLATTEN tags AS tag WHERE tag GROUP BY tag SORT length(rows) DESC LIMIT 30`
  };
}
const EVAL_TIMEOUT_MS = Number(process.env.OBSIDIAN_TIMEOUT_MS) || 1e4;
function payload(sql) {
  const safe = sql.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `(async()=>{const dv=app.plugins.plugins.dataview&&app.plugins.plugins.dataview.api;if(!dv)return JSON.stringify({error:'dataview-not-loaded'});try{const r=await dv.query(\`${safe}\`);return JSON.stringify(r.successful?r.value:{error:r.error});}catch(e){return JSON.stringify({error:String(e)});}})()`;
}
function not_open_error() {
  return new Error(
    `Obsidian is not running with the vault "${fs.vault_name()}" open. Open the vault in Obsidian (with the Dataview plugin enabled), then retry. Override the wait window with OBSIDIAN_TIMEOUT_MS.`
  );
}
function run_dql(sql) {
  let stdout;
  try {
    stdout = execFileSync(
      fs.obsidian_cli(),
      [`vault=${fs.vault_name()}`, "eval", `code=${payload(sql)}`],
      { encoding: "utf8", timeout: EVAL_TIMEOUT_MS, windowsHide: true }
    );
  } catch (e) {
    if (e.code === "ETIMEDOUT" || e.killed) throw not_open_error();
    throw e;
  }
  const m = stdout.match(/=>\s*([\s\S]+?)\s*$/);
  if (!m) throw not_open_error();
  const data = JSON.parse(m[1].trim());
  if (data?.error) throw new Error(`Dataview: ${data.error}`);
  return data;
}
function run_all() {
  const out = {};
  for (const [k, sql] of Object.entries(build_queries())) {
    try {
      out[k] = run_dql(sql);
    } catch (e) {
      out[k] = { error: e.message };
    }
  }
  return out;
}
function cell(value) {
  if (value && typeof value === "object" && value.path) return basename(value.path, ".md");
  if (Array.isArray(value)) return value.map(cell).join(" ");
  return value == null ? "" : String(value);
}
function table(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.length ? rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n") : `| _empty_ |${" |".repeat(headers.length - 1)}`;
  return `${head}
${sep}
${body}`;
}
function section_table(title, result) {
  if (result?.error) return `## ${title}
_${result.error}_`;
  if (!result) return `## ${title}
_no data_`;
  return `## ${title}
${table(result.headers, result.values || [])}`;
}
function section_list(title, result) {
  if (result?.error) return `## ${title}
_${result.error}_`;
  const values = result?.values || [];
  if (!values.length) return `## ${title}
_none_`;
  return `## ${title}
${values.map((v) => `- ${cell(v)}`).join("\n")}`;
}
function render(data) {
  return [
    `# Vicky Dashboard`,
    `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}  \xB7  Vault: \`${fs.vault_name()}\``,
    section_table("Counts", data.counts),
    section_table("Recent additions (last 14 days)", data.recent),
    section_table("Most important nodes (hubs)", data.hubs),
    section_table("Pending queue", data.pending),
    section_table("Sources awaiting synthesis (no inbound conclusion)", data.awaiting_synthesis),
    section_list("Orphans (no in/out links)", data.orphans),
    section_table("Stale conclusions (>60d, <2 inlinks)", data.stale),
    section_table("Stale sources (cited but old, >90d)", data.stale_sources),
    section_table("Tag cloud", data.tags)
  ].join("\n\n");
}
function build_dashboard() {
  const data = run_all();
  return { data, markdown: render(data) };
}
export {
  build_dashboard,
  run_dql
};
