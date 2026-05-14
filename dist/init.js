#!/usr/bin/env node
import { createRequire } from "module"; const require = createRequire(import.meta.url);

// src/init.js
import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from "fs";
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
var graphifyignore = () => join(root(), ".graphifyignore");
var template_dir = () => join(SKILL_DIR, "..", "obsidian");

// src/init.js
var GRAPHIFYIGNORE = [
  "# Vicky-managed \u2014 controls graphify extract scope.",
  "# Keep sources/ and conclusions/ as the only content corpora.",
  "pending/",
  "graphs/",
  ".graphify/",
  ".obsidian/",
  "node_modules/",
  "Dashboard.md",
  "Dashboard.report.md",
  "WORKFLOW.md",
  ""
].join("\n");
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
  return {
    skill: "vicky",
    status: "ready",
    instructions: [
      "Vicky KB scaffolded.",
      `Vault: ${root()}`,
      "",
      "NEXT: invoke the `/vicky:setup` skill now to load Vicky context (tool list,",
      "WORKFLOW.md rules, dashboard/DQL prerequisites). Do this before answering",
      "the user's first question."
    ].join("\n")
  };
}
var initialized = false;
async function init() {
  for (const directory of [sources(), conclusions(), pending(), graphs()]) {
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  }
  copy_tree(template_dir(), root());
  const ignore = graphifyignore();
  if (!existsSync(ignore)) writeFileSync(ignore, GRAPHIFYIGNORE);
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
