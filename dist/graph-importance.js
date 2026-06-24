import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "./fs-wrapper.js";
import { join } from "path";
import * as fs from "./paths.js";
function getIndexedFiles(sourcesDir) {
  try {
    const indexed = /* @__PURE__ */ new Set();
    if (!existsSync(sourcesDir)) return indexed;
    const sourceFiles = readdirSync(sourcesDir).filter((f) => f.endsWith(".md"));
    for (const sf of sourceFiles) {
      const path = join(sourcesDir, sf);
      const content = readFileSync(path, "utf8");
      const match = content.match(/^indexed_file:\s*(.+)$/m);
      if (match) indexed.add(match[1].trim());
    }
    return indexed;
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function analyzeFileImportance(limit = 30, tier = 0, tiersSize = 100) {
  const astPath = join(fs.root(), ".graphify", ".graphify_ast.json");
  if (!existsSync(astPath)) {
    return { ok: false, reason: "no_ast", message: "Run graphify extract first to generate AST" };
  }
  console.log("[vicky] Analyzing file importance from AST...");
  try {
    const ast = JSON.parse(readFileSync(astPath, "utf8"));
    const fileReferences = {};
    const fileInfo = {};
    if (ast.nodes) {
      for (const node of ast.nodes) {
        if (!node.file) continue;
        fileReferences[node.file] = (fileReferences[node.file] || 0) + 1;
        if (!fileInfo[node.file]) {
          fileInfo[node.file] = {
            file: node.file,
            ast_nodes: 0,
            references: 0,
            type: node.type,
            language: node.language
          };
        }
        fileInfo[node.file].ast_nodes++;
        if (node.edges) {
          for (const edge of node.edges) {
            if (edge.target_file && edge.target_file !== node.file) {
              fileInfo[node.file].references = (fileInfo[node.file].references || 0) + 1;
            }
          }
        }
      }
    }
    console.log("[vicky] Grep analysis for file references...");
    const grepCounts = {};
    try {
      const root = fs.root();
      const pattern = Object.keys(fileInfo).slice(0, 50).map((f) => f.split("/").pop()).join("\\|");
      if (pattern) {
        const cmd = `grep -r "${pattern}" "${root}" --include="*.ts" --include="*.tsx" --include="*.vue" --include="*.php" --include="*.js" 2>/dev/null | cut -d: -f1 | sort | uniq -c | sort -rn`;
        const output = execSync(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
        for (const line of output.split("\n")) {
          const match = line.trim().match(/^(\d+)\s+(.+)$/);
          if (match) {
            grepCounts[match[2]] = parseInt(match[1]);
          }
        }
      }
    } catch (e) {
      console.warn("[vicky] Grep analysis failed, using AST data only");
    }
    console.log("[vicky] Git history analysis...");
    const gitCounts = {};
    try {
      const root = fs.root();
      const cmd = `cd "${root}" && git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -100`;
      const output = execSync(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
      for (const line of output.split("\n")) {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match && match[2]) {
          gitCounts[match[2]] = parseInt(match[1]);
        }
      }
    } catch (e) {
      console.warn("[vicky] Git analysis skipped (not a git repo or access issue)");
    }
    const scored = Object.entries(fileInfo).map(([file, info]) => ({
      file,
      ast_score: info.ast_nodes * 10,
      grep_score: grepCounts[file] || 0,
      git_score: gitCounts[file] || 0,
      reference_score: info.references * 5,
      total_score: info.ast_nodes * 10 + (grepCounts[file] || 0) + (gitCounts[file] || 0) + info.references * 5,
      language: info.language
    }));
    scored.sort((a, b) => b.total_score - a.total_score);
    const tierStart = tier * tiersSize;
    const tierEnd = (tier + 1) * tiersSize;
    const indexed = getIndexedFiles(fs.sources());
    let tiered = scored.filter((_, i) => i >= tierStart && i < tierEnd).filter((f) => !indexed.has(f.file));
    if (tiered.length === 0) {
      tiered = scored.filter((f) => !indexed.has(f.file)).slice(0, limit);
    } else {
      tiered = tiered.slice(0, limit);
    }
    const top = tiered.length > 0 ? tiered : scored.slice(0, limit);
    console.log(`
[vicky] Top ${limit} most important files:
`);
    for (let i = 0; i < top.length; i++) {
      const f = top[i];
      console.log(`${i + 1}. ${f.file}`);
      console.log(`   Score: ${f.total_score} (AST: ${f.ast_score}, Grep: ${f.grep_score}, Refs: ${f.reference_score})`);
      console.log(`   Language: ${f.language}`);
    }
    const markdown = `# File Importance Analysis

Generated from AST + grep frequency analysis.

## Top ${limit} Files by Importance Score

| Rank | File | Score | Language | Notes |
|------|------|-------|----------|-------|
${top.map((f, i) => `| ${i + 1} | \`${f.file}\` | ${f.total_score} | ${f.language} | AST: ${f.ast_score}, Grep: ${f.grep_score}, Refs: ${f.reference_score} |`).join("\n")}

## Indexing Priority

Create vicky sources in this order for highest-value KB coverage.`;
    const tiersCovered = [];
    for (let t = 0; t < Math.ceil(scored.length / tiersSize); t++) {
      const tierStart2 = t * tiersSize;
      const tierEnd2 = Math.min((t + 1) * tiersSize, scored.length);
      const tierFiles = scored.slice(tierStart2, tierEnd2);
      const indexed_in_tier = tierFiles.filter((f) => indexed.has(f.file)).length;
      tiersCovered.push({
        tier: t,
        total: tierFiles.length,
        indexed: indexed_in_tier,
        coverage: Math.round(indexed_in_tier / tierFiles.length * 100)
      });
    }
    return {
      ok: true,
      top_files: top.map((f) => f.file),
      scores: top,
      markdown,
      total_analyzed: scored.length,
      current_tier: tier,
      tier_size: tiersSize,
      tier_coverage: tiersCovered
    };
  } catch (e) {
    return { ok: false, reason: "parse_error", message: e.message };
  }
}
async function coverageReport(tiersSize = 100) {
  const astPath = join(fs.root(), ".graphify", ".graphify_ast.json");
  if (!existsSync(astPath)) {
    return { ok: false, reason: "no_ast", message: "Run graphify extract first" };
  }
  const ast = JSON.parse(readFileSync(astPath, "utf8"));
  const fileInfo = {};
  if (ast.nodes) {
    for (const node of ast.nodes) {
      if (!node.file) continue;
      if (!fileInfo[node.file]) {
        fileInfo[node.file] = { file: node.file, count: 0 };
      }
      fileInfo[node.file].count++;
    }
  }
  const scored = Object.values(fileInfo).map((f) => ({ ...f, score: f.count * 10 })).sort((a, b) => b.score - a.score);
  const indexed = getIndexedFiles(fs.sources());
  const tiers = [];
  for (let t = 0; t < Math.ceil(scored.length / tiersSize); t++) {
    const tierStart = t * tiersSize;
    const tierEnd = Math.min((t + 1) * tiersSize, scored.length);
    const tierFiles = scored.slice(tierStart, tierEnd);
    const indexed_in_tier = tierFiles.filter((f) => indexed.has(f.file)).length;
    tiers.push({
      tier: t,
      total: tierFiles.length,
      indexed: indexed_in_tier,
      coverage: Math.round(indexed_in_tier / tierFiles.length * 100)
    });
  }
  return {
    ok: true,
    tiers,
    total_indexed: indexed.size,
    total_files: scored.length
  };
}
var graph_importance_default = analyzeFileImportance;
export {
  analyzeFileImportance,
  coverageReport,
  graph_importance_default as default
};
