import { z } from "zod";
import * as jobs from "../jobs.js";
function register(server) {
  server.registerTool("job-status", {
    description: "Poll the status of a background job (learn, relink) by job_id. Returns running|done|failed|unknown, progress.phase, counts, and elapsed_ms.",
    inputSchema: {
      job_id: z.string().describe("The job_id returned from learn or relink.")
    }
  }, async ({ job_id }) => {
    const j = jobs.get(job_id);
    if (!j) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "unknown", job_id }) }] };
    }
    const out = {
      status: j.status,
      kind: j.kind,
      progress: j.progress,
      counts: j.counts,
      elapsed_ms: Date.now() - j.started
    };
    if (j.error) out.error = j.error;
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  });
}
export {
  register
};
