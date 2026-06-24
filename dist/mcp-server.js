#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "./fs-wrapper.js";
import * as query from "./tools/query.js";
import * as researchGap from "./tools/research-gap.js";
import * as remember from "./tools/remember.js";
import * as conclude from "./tools/conclude.js";
import * as relink from "./tools/relink.js";
import * as learn from "./tools/learn.js";
import * as enqueue from "./tools/enqueue.js";
import * as webSearch from "./tools/web-research.js";
import * as dashboard from "./tools/dashboard.js";
import * as dql from "./tools/dql.js";
import * as jobStatus from "./tools/job-status.js";
import * as crystalize from "./tools/crystalize.js";
let config = {
  autoEnrichDefault: true,
  autoResearchGaps: true,
  researchQueueProcessThreshold: 5
};
try {
  const configPath = "./vicky.config.json";
  const configText = readFileSync(configPath, "utf8");
  config = { ...config, ...JSON.parse(configText) };
} catch (_) {
}
const server = new McpServer({
  name: "vicky",
  version: "0.9.0",
  description: config.description || "Demand-driven KB: auto-enrich via research-gap"
});
const notify = (level, data) => {
  try {
    server.server.sendNotification("notifications/message", { level, data });
  } catch (_) {
  }
};
if (config.systemPrompt?.enabled) {
  notify("info", `Vicky: ${config.systemPrompt.text}`);
}
query.register(server);
researchGap.register(server, notify);
remember.register(server);
conclude.register(server);
relink.register(server, notify);
learn.register(server, notify);
enqueue.register(server);
webSearch.register(server, notify);
dashboard.register(server);
dql.register(server);
jobStatus.register(server);
crystalize.register(server);
const transport = new StdioServerTransport();
await server.connect(transport);
export {
  config
};
