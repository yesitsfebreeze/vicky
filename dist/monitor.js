import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "./fs-wrapper.js";
import { join } from "path";
import * as fs from "./paths.js";
import { analyzeFileImportance, coverageReport } from "./graph-importance.js";
async function runMonitor(updateInterval = 5e3) {
  console.clear();
  async function updateDisplay() {
    console.clear();
    console.log("\u{1F50D} Vicky KB Building Monitor\n");
    console.log(`Workspace: ${fs.root()}`);
    console.log(`Updated: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}
`);
    try {
      const coverage = await coverageReport(50);
      if (!coverage.ok) {
        console.log("\u26A0\uFE0F  No AST available. Run graphify first:\n");
        console.log("  node vicky graph-importance 0 30\n");
        return;
      }
      console.log("\u{1F4CA} Tier Progress:\n");
      let nextIncomplete = null;
      for (const tier of coverage.tiers) {
        const bar = "\u2588".repeat(Math.floor(tier.coverage / 5)) + "\u2591".repeat(20 - Math.floor(tier.coverage / 5));
        const status = tier.coverage === 100 ? "\u2713" : tier.indexed > 0 ? "\u2299" : "\u25CB";
        console.log(`  ${status} Tier ${tier.tier}: [${bar}] ${tier.indexed}/${tier.total} (${tier.coverage}%)`);
        if (!nextIncomplete && tier.coverage < 100) {
          nextIncomplete = tier.tier;
        }
      }
      console.log();
      const totalCoverage = Math.round(coverage.total_indexed / coverage.total_files * 100);
      console.log(`\u{1F4C8} Overall: ${coverage.total_indexed}/${coverage.total_files} (${totalCoverage}%) indexed
`);
      if (nextIncomplete !== null) {
        const tier = coverage.tiers[nextIncomplete];
        const remaining = tier.total - tier.indexed;
        console.log(`\u{1F4A1} Next: Index tier ${nextIncomplete} (${remaining} files remaining)`);
        console.log(`   Run: vicky graph-importance ${nextIncomplete} 20
`);
      } else {
        console.log("\u{1F389} All tiers indexed!\n");
      }
      try {
        const sourceDir = fs.sources();
        if (existsSync(sourceDir)) {
          const files = readdirSync(sourceDir).filter((f) => f.endsWith(".md")).map((f) => {
            const stat = require("fs").statSync(join(sourceDir, f));
            return { file: f, mtime: stat.mtime };
          }).sort((a, b) => b.mtime - a.mtime).slice(0, 5);
          if (files.length > 0) {
            console.log("\u{1F4DD} Recently indexed:\n");
            for (const f of files) {
              const ago = Math.round((Date.now() - f.mtime.getTime()) / 1e3);
              const timeStr = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago / 60)}m` : `${Math.floor(ago / 3600)}h`;
              console.log(`   \u2022 ${f.file.substring(0, 40)} (${timeStr} ago)`);
            }
            console.log();
          }
        }
      } catch (e) {
      }
      console.log("Press Ctrl+C to stop monitoring.\n");
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }
  await updateDisplay();
  const interval = setInterval(updateDisplay, updateInterval);
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n\nMonitor stopped.\n");
    process.exit(0);
  });
}
var monitor_default = runMonitor;
export {
  monitor_default as default,
  runMonitor
};
