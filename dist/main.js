#!/usr/bin/env node
const mode = process.argv[2] || "mcp";
if (mode === "init") {
  const { init } = await import("./init.js");
  const result = await init();
  console.log(JSON.stringify(result, null, 2));
} else if (mode === "dashboard") {
  const args = process.argv.slice(3);
  const { build_dashboard } = await import("./dashboard.js");
  const { mkdirSync, writeFileSync } = await import("./fs-wrapper.js");
  const fs = await import("./paths.js");
  try {
    const { data, markdown } = build_dashboard();
    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else if (args.includes("--write")) {
      mkdirSync(fs.root(), { recursive: true });
      writeFileSync(fs.report_md(), markdown);
      console.log(fs.report_md());
    } else {
      console.log(markdown);
    }
  } catch (e) {
    console.error(`dashboard: ${e.message}`);
    process.exit(1);
  }
} else if (mode === "tag-context") {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    let prompt = "";
    try {
      const payload = JSON.parse(raw);
      prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    } catch (_) {
    }
    if (prompt) {
      const { collect_tags, build_context } = await import("./hooks/tag-context.js");
      const out = build_context(prompt, collect_tags());
      if (out) console.log(out);
    }
  } catch (_) {
  }
  process.exit(0);
} else if (mode === "graph-importance") {
  try {
    const tier = parseInt(process.argv[3]) || 0;
    const limit = parseInt(process.argv[4]) || 30;
    const { analyzeFileImportance } = await import("./graph-importance.js");
    const result = await analyzeFileImportance(limit, tier);
    if (result.ok) {
      console.log(`
${result.markdown}
`);
      console.log(`
[Tier ${result.current_tier}/${Math.ceil(result.total_analyzed / result.tier_size) - 1}] Analyzed ${result.total_analyzed} files. Priority order in vicky sources.`);
      if (result.tier_coverage.length > 0) {
        console.log("\n\u{1F4CA} Coverage by tier:");
        for (const t of result.tier_coverage) {
          const bar = "\u2588".repeat(t.coverage / 5) + "\u2591".repeat(20 - t.coverage / 5);
          console.log(`  Tier ${t.tier}: [${bar}] ${t.indexed}/${t.total} (${t.coverage}%)`);
        }
      }
    } else {
      console.error(`graph-importance: ${result.message}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`graph-importance: ${e.message}`);
    process.exit(1);
  }
} else if (mode === "coverage-report") {
  try {
    const { coverageReport } = await import("./graph-importance.js");
    const result = await coverageReport();
    if (result.ok) {
      console.log("\n\u{1F4C8} KB Coverage Report\n");
      console.log(`Total files analyzed: ${result.total_files}`);
      console.log(`Total files indexed: ${result.total_indexed}
`);
      console.log("Coverage by tier:");
      for (const tier of result.tiers) {
        const bar = "\u2588".repeat(Math.floor(tier.coverage / 5)) + "\u2591".repeat(20 - Math.floor(tier.coverage / 5));
        console.log(`  Tier ${tier.tier}: [${bar}] ${tier.indexed}/${tier.total} (${tier.coverage}%)`);
      }
      const totalCoverage = Math.round(result.total_indexed / result.total_files * 100);
      console.log(`
Overall: ${totalCoverage}% complete
`);
    } else {
      console.error(`coverage-report: ${result.message}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`coverage-report: ${e.message}`);
    process.exit(1);
  }
} else if (mode === "monitor") {
  try {
    const interval = parseInt(process.argv[3]) || 5e3;
    const { runMonitor } = await import("./monitor.js");
    await runMonitor(interval);
  } catch (e) {
    console.error(`monitor: ${e.message}`);
    process.exit(1);
  }
} else if (mode === "mcp" || mode === void 0) {
  await import("./mcp-server.js");
} else {
  console.error(`vicky: unknown mode "${mode}". Valid: mcp | init | dashboard | tag-context | graph-importance | coverage-report | monitor`);
  process.exit(2);
}
