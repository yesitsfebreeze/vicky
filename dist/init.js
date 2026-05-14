#!/usr/bin/env node
import { createRequire } from "module"; const require = createRequire(import.meta.url);

// src/init.js
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "fs";
import { join as join2 } from "path";

// src/fs.js
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
var SKILL_DIR = dirname(fileURLToPath(import.meta.url));
var root = () => process.env.VICKY_ROOT || ".vicky";
var sources = () => join(root(), "sources");
var conclusions = () => join(root(), "conclusions");
var pending = () => join(root(), "pending");
var graphs = () => join(root(), "graphs");
var workflow_md = () => join(root(), "WORKFLOW.md");
var dashboard_md = () => join(root(), "Dashboard.md");
var template_dir = () => join(SKILL_DIR, "..", "obsidian");

// src/init.js
function copy_tree(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  for (const entry2 of readdirSync(source, { withFileTypes: true })) {
    const from = join2(source, entry2.name);
    const to = join2(destination, entry2.name);
    if (entry2.isDirectory()) copy_tree(from, to);
    else if (entry2.isFile() && !existsSync(to)) copyFileSync(from, to);
  }
}
function banner() {
  const root2 = root();
  return {
    skill: "vicky",
    status: "ready",
    instructions: [
      "Vicky KB Active",
      "",
      `Read ${workflow_md()} first \u2014 focus, rules, routing.`,
      "",
      "Default behavior: questions auto-check KB via research-gap.",
      "- Found? Returns context, focus-biased.",
      "- Gap?   Auto-enqueues research. Run research to drain.",
      "",
      "Tools:",
      '  research-gap "question"  Query KB, auto-enqueue gaps',
      "  research                 Drain pending queue",
      '  remember "title"         Save findings',
      "  dashboard                KB report via Obsidian + Dataview",
      '  dql "<query>"            Run arbitrary DQL (query="help" for syntax)',
      "",
      "Dashboard + DQL require Obsidian running with the vault open and Dataview enabled.",
      `Live view: ${dashboard_md()}`,
      `Vault:     ${root2}`
    ].join("\n")
  };
}
var initialized = false;
async function init() {
  for (const directory of [sources(), conclusions(), pending(), graphs()]) {
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  }
  copy_tree(template_dir(), root());
  initialized = true;
  return banner();
}
async function ensure_init() {
  if (initialized) return banner();
  return init();
}
var entry = process.argv[1] || "";
if (entry.endsWith("init.js")) {
  const result = await init();
  console.log(JSON.stringify(result, null, 2));
}
var init_default = init;
export {
  init_default as default,
  ensure_init,
  init
};
