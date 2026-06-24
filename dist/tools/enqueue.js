import { z } from "zod";
import { existsSync } from "../fs-wrapper.js";
import { join } from "path";
import * as fs from "../paths.js";
import { enqueue_research, list_pending, slugify } from "../vault.js";
import { ensure_init } from "../init.js";
const PENDING_TYPE = "research-pending";
const MAX_TITLE = 80;
function validate_frontmatter(fm) {
  const missing = ["type", "date", "tags"].filter((k) => fm[k] === void 0 || fm[k] === null);
  if (missing.length) return `Missing required frontmatter fields after defaults: ${missing.join(", ")}`;
  if (!Array.isArray(fm.tags)) return "tags must be an array";
  return null;
}
function register(server) {
  server.registerTool("enqueue", {
    description: "Queue a research question. Non-blocking \u2014 writes a pending stub. /vicky:research fetches sources for it and absorbs; /vicky:learn drains pending without fetching.",
    inputSchema: {
      question: z.string().describe("The research question to investigate later"),
      context: z.string().optional().describe("Why this is needed / surrounding context"),
      requested_by: z.string().optional().describe("File, task, or topic that triggered the request"),
      priority: z.enum(["low", "med", "high"]).optional().describe("Default: med"),
      sources: z.array(z.string()).optional().describe("Existing source note titles that prompted this question (linked via [[wikilinks]] in the resulting conclusion)"),
      type: z.string().optional().describe("Frontmatter type (default: research-pending)"),
      date: z.string().optional().describe("ISO date YYYY-MM-DD (default: today)"),
      tags: z.array(z.string()).optional().describe("Frontmatter tags (default: [research, pending])")
    }
  }, async ({ question, context, requested_by, priority, sources = [], type, date, tags }) => {
    await ensure_init();
    if (!question || !question.trim()) {
      return { content: [{ type: "text", text: "Error: question is required." }], isError: true };
    }
    if (question.length > MAX_TITLE) {
      return { content: [{ type: "text", text: `Error: question length ${question.length} exceeds ${MAX_TITLE}. Shorten the title and pass long-form text via 'context'.` }], isError: true };
    }
    const fm = {
      type: type || PENDING_TYPE,
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      tags: Array.isArray(tags) ? tags : ["research", "pending"]
    };
    const err = validate_frontmatter(fm);
    if (err) return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
    const slug = slugify(question);
    const path = join(fs.pending(), `${slug}.md`);
    if (existsSync(path)) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "duplicate", path }) }] };
    }
    const out = enqueue_research(question, { context, requested_by, priority, sources });
    const depth = list_pending().length;
    return { content: [{ type: "text", text: `Queued: ${out}
Pending queue depth: ${depth}` }] };
  });
}
export {
  register
};
