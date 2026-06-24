import { existsSync, readFileSync, statSync } from "./fs-wrapper.js";
import * as fs from "./paths.js";
const DEFAULTS = {
  active_focus: [],
  priority_tags: [],
  research_depth: "default",
  auto_enqueue: true,
  min_sources_per_conclusion: 2,
  default_workflow: "default"
};
function parse_frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  let key = null;
  let list = null;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const kv = raw.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const val = kv[2].trim();
      if (!val) {
        list = [];
        out[key] = list;
        continue;
      }
      list = null;
      if (val === "true") {
        out[key] = true;
        continue;
      }
      if (val === "false") {
        out[key] = false;
        continue;
      }
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        out[key] = Number(val);
        continue;
      }
      if (val.startsWith("[") && val.endsWith("]")) {
        out[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        continue;
      }
      out[key] = val.replace(/^["']|["']$/g, "");
    } else if (list && /^\s*-\s+/.test(raw)) {
      list.push(raw.replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
    }
  }
  return out;
}
function parse_routing(text) {
  const sec = text.match(/##\s+Routing[\s\S]*?(?=\n##\s|\n*$)/i);
  if (!sec) return [];
  const rows = [];
  for (const line of sec[0].split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const wf = cells[cells.length - 1];
    let pat = cells.slice(0, -1).join("|").replace(/^`|`$/g, "").trim();
    if (/^pattern$/i.test(pat) || /^[-:\s]+$/.test(pat)) continue;
    if (pat === "(default)") {
      rows.push({ default: true, workflow: wf });
      continue;
    }
    const re = pat.match(/^\/(.+)\/([a-z]*)$/);
    try {
      rows.push({ regex: re ? new RegExp(re[1], re[2] || "i") : new RegExp(pat, "i"), workflow: wf });
    } catch {
    }
  }
  return rows;
}
function parse_section(text, name) {
  const re = new RegExp(`##\\s+${name}[\\s\\S]*?(?=\\n##\\s|\\n*$)`, "i");
  const m = text.match(re);
  if (!m) return [];
  return m[0].split(/\r?\n/).slice(1).filter((l) => /^\s*-\s+/.test(l) && !/^\s*-\s*\(/.test(l)).map((l) => l.replace(/^\s*-\s+/, "").trim());
}
let cache = null;
let cache_mtime = 0;
function load_workflow() {
  const path = fs.workflow_md();
  if (!existsSync(path)) return { ...DEFAULTS, routing: [], rules: [], focus: [] };
  try {
    const { mtimeMs } = statSync(path);
    if (cache && mtimeMs === cache_mtime) return cache;
  } catch {
  }
  const text = readFileSync(path, "utf8");
  const fm = parse_frontmatter(text);
  const merged = { ...DEFAULTS, ...fm };
  const wf = {
    ...merged,
    focus: Array.isArray(merged.active_focus) ? merged.active_focus : [],
    rules: parse_section(text, "Active Rules"),
    routing: parse_routing(text)
  };
  cache = wf;
  try {
    cache_mtime = statSync(path).mtimeMs;
  } catch {
  }
  return wf;
}
function get_workflow_for(question) {
  const wf = load_workflow();
  for (const r of wf.routing) {
    if (r.default) continue;
    if (r.regex && r.regex.test(question)) return r.workflow;
  }
  const def = wf.routing.find((r) => r.default);
  return def?.workflow || wf.default_workflow || "default";
}
function should_auto_enqueue() {
  return load_workflow().auto_enqueue !== false;
}
function get_focus() {
  return load_workflow().focus;
}
function get_rules() {
  return load_workflow().rules;
}
function bias_by_focus(text) {
  const focus = get_focus();
  if (!focus.length || !text) return text;
  const lower = text.toLowerCase();
  const hits = focus.filter((f) => lower.includes(String(f).toLowerCase()));
  if (!hits.length) return text;
  return `[focus match: ${hits.join(", ")}]

${text}`;
}
export {
  bias_by_focus,
  get_focus,
  get_rules,
  get_workflow_for,
  load_workflow,
  should_auto_enqueue
};
