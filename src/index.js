#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import * as query       from './tools/query.js';
import * as researchGap from './tools/research-gap.js';
import * as remember    from './tools/remember.js';
import * as relink      from './tools/relink.js';
import * as research    from './tools/research.js';
import * as enqueue     from './tools/enqueue.js';
import * as webSearch   from './tools/web-research.js';
import * as promote     from './tools/promote.js';
import * as completeResearch from './tools/complete-research.js';

// Load config with defaults
let config = {
	autoEnrichDefault: true,
	autoResearchGaps: true,
	researchQueueProcessThreshold: 5
};

try {
	const configPath = resolve('./vicky.config.json');
	const configText = readFileSync(configPath, 'utf8');
	config = { ...config, ...JSON.parse(configText) };
} catch (_) {
	// Use defaults if config not found
}

const server = new McpServer({
	name: 'vicky',
	version: '0.2.0',
	description: config.description || 'Demand-driven KB: auto-enrich via research-gap'
});

const notify = (level, data) => {
	try { server.server.sendNotification('notifications/message', { level, data }); } catch (_) {}
};

// Inject system prompt notification if enabled
if (config.systemPrompt?.enabled) {
	notify('info', `Vicky: ${config.systemPrompt.text}`);
}

query.register(server);
researchGap.register(server, notify);
remember.register(server);
relink.register(server, notify);
research.register(server, notify);
enqueue.register(server);
webSearch.register(server, notify);
promote.register(server);
completeResearch.register(server);

const transport = new StdioServerTransport();
await server.connect(transport);

// Export config for hooks/integration
export { config };
