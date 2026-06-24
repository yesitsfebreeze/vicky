import { dirname, join, basename, resolve } from "path";
import { fileURLToPath } from "url";
const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const root = () => process.env.VICKY_ROOT || "vicky";
const kb_base = () => root();
const sources = () => join(root(), "sources");
const absorbed = () => join(sources(), ".absorbed");
const conclusions = () => join(root(), "conclusions");
const pending = () => join(root(), "pending");
const graphs = () => join(root(), "graphs");
const graphify_out = () => join(root(), ".graphify");
const kb_graph = () => join(graphify_out(), "graph.json");
const kb_wiki = () => join(graphs(), "vicky.md");
const graphifyignore = () => join(root(), ".graphifyignore");
const workflow_md = () => join(root(), "WORKFLOW.md");
const dashboard_md = () => join(root(), "Dashboard.md");
const report_md = () => join(root(), "Dashboard.report.md");
const template_dir = () => join(SKILL_DIR, "..", "scaffold");
const vault_name = () => process.env.OBSIDIAN_VAULT || basename(resolve(root(), ".."));
const obsidian_cli = () => process.env.OBSIDIAN_CLI || (process.platform === "win32" ? "obsidian.com" : "obsidian");
export {
  absorbed,
  conclusions,
  dashboard_md,
  graphify_out,
  graphifyignore,
  graphs,
  kb_base,
  kb_graph,
  kb_wiki,
  obsidian_cli,
  pending,
  report_md,
  root,
  sources,
  template_dir,
  vault_name,
  workflow_md
};
