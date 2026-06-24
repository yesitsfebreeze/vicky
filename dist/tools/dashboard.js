import { z } from "zod";
import { build_dashboard } from "../dashboard.js";
import { ensure_init } from "../init.js";
function register(server) {
  server.registerTool("dashboard", {
    description: "Render the KB dashboard (counts, recent additions, hubs, pending queue, orphans, stale conclusions, tag cloud) via Obsidian + Dataview. Requires the vault to be open in Obsidian with the Dataview plugin enabled. For ad-hoc queries use the `dql` tool.",
    inputSchema: {
      format: z.enum(["markdown", "json"]).optional().describe("Output format (default: markdown)")
    }
  }, async ({ format = "markdown" }) => {
    await ensure_init();
    try {
      const { data, markdown } = build_dashboard();
      const text = format === "json" ? JSON.stringify(data, null, 2) : markdown;
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `dashboard: ${e.message}` }], isError: true };
    }
  });
}
export {
  register
};
