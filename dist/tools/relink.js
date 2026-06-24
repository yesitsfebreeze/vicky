import { readdirSync } from "../fs-wrapper.js";
import * as fs from "../paths.js";
import { update_kb } from "../graph.js";
import { relink_dir } from "../link.js";
import { ensure_init } from "../init.js";
import * as jobs from "../jobs.js";
function est_relink_seconds() {
  try {
    const n = readdirSync(fs.conclusions()).filter((f) => f.endsWith(".md")).length;
    return Math.max(10, Math.min(600, Math.round(n * 0.3)));
  } catch {
    return 10;
  }
}
function register(server, notify) {
  server.registerTool("relink", {
    description: "Rebuild related: frontmatter for all files from the unified KB graph. Runs independently of a research pass.",
    inputSchema: {}
  }, async () => {
    await ensure_init();
    const existing = jobs.reject_if_running("relink");
    if (existing) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "queued", job_id: existing, est_seconds: est_relink_seconds() }) }] };
    }
    const job_id = jobs.create("relink");
    (async () => {
      try {
        jobs.update(job_id, { progress: { phase: "graph" } });
        notify("info", "vicky relink: updating KB graph...");
        const upd = await update_kb();
        if (upd && upd.ok === false) {
          const hint = upd.reason === "no_backend" ? "set GEMINI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) and retry" : upd.reason === "graphify_missing" ? "run `npm install` in the vicky plugin root" : "corpus may be too small for a graph";
          notify("info", `vicky relink: graph not produced (${upd.reason}) \u2014 ${hint}.`);
          jobs.update(job_id, { status: "failed", error: `graph_not_produced:${upd.reason}` });
          return;
        }
        notify("info", `vicky relink: graph built via ${upd?.backend ?? "graphify"}; querying for related links...`);
        jobs.update(job_id, { progress: { phase: "relink" } });
        const graph = fs.kb_graph();
        const [src, con] = await Promise.all([
          relink_dir(fs.sources(), graph),
          relink_dir(fs.conclusions(), graph)
        ]);
        notify("info", `vicky relink done: ${src.patched + con.patched} relinked (${src.patched}/${src.total} sources, ${con.patched}/${con.total} conclusions).`);
        jobs.update(job_id, {
          status: "done",
          counts: { relinked: src.patched + con.patched, sources_relinked: src.patched, sources_total: src.total, conclusions_relinked: con.patched, conclusions_total: con.total }
        });
      } catch (e) {
        jobs.update(job_id, { status: "failed", error: e.message });
        notify("error", `vicky relink failed: ${e.message}`);
      }
    })();
    return { content: [{ type: "text", text: JSON.stringify({ status: "queued", job_id, est_seconds: est_relink_seconds() }) }] };
  });
}
export {
  register
};
