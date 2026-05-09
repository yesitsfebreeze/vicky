# Vicky KB Plugin

Demand-driven knowledge base for coding agents. Auto-enriches answers when gaps detected.

## Quick Start

### For Claude Code users

**Install:** Follow [agents/claude/install.md](agents/claude/install.md)

**Update:** Follow [agents/claude/update.md](agents/claude/update.md)

### For other agents

Use generic install/update guides:
- **Install:** [INSTALL.md](INSTALL.md)
- **Update:** [UPDATE.md](UPDATE.md)

## What it does

- Query local KB (conclusions + sources)
- Auto-detect knowledge gaps
- Auto-enqueue web research
- Enrich conclusions on-demand
- Zero config, zero setup

## Installation (Claude Code)

1. **Clone:**
   ```bash
   git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
   cd ~/.claude/plugins/vicky
   npm install
   ```

2. **Create manifest:**
   ```bash
   cat > ~/.claude/plugins/vicky/.claude-plugin << 'EOF'
   {
     "name": "vicky",
     "version": "0.2.0",
     "description": "Demand-driven knowledge base: auto-enrich via research-gap",
     "mcp": {
       "command": "node",
       "args": ["src/index.js"]
     }
   }
   EOF
   ```

3. **Restart Claude Code**

4. **Test:** `/vic:research-gap "test question"`

See [agents/claude/install.md](agents/claude/install.md) for detailed troubleshooting.

## Usage

### Commands
- `/vic:research-gap "question"` — Query KB → found: return context | gap: auto-enqueue research
- `/vic:research` — Process pending gaps, enrich KB
- `/vic:remember "title"` — Save findings to vault
- `/vic:enqueue "question"` — Manual queue
- `/vic:query "question"` — Direct KB query

### Workflow
1. Ask a question in Claude Code
2. Vicky auto-checks KB
   - Found? → Returns answer + sources
   - Gap? → Auto-queues for research
3. Run `/vic:research` when ready
4. Call `/vic:remember "title"` with findings
5. Next time, same question returns from KB

## Architecture

```
.vicky/                   # Auto-created in project root
├── sources/              # Markdown files from web research
├── conclusions/          # Synthesized KB (queries + links)
├── pending/              # Queued research questions
└── graphs/               # JSON knowledge graphs
```

## Requirements

- **Node.js** 18+
- **npm** 9+
- Claude Code or other coding agent

## Optional

- **graphify CLI** (for enhanced KB querying)
  - Install: `npm install -g @anthropics/graphify`
  - Without it: text search fallback works

## How it works

1. **Init:** Creates `.vicky/` structure on first use
2. **Tools:** MCP server provides 7 tools
3. **Auto-check:** Questions trigger KB lookup
4. **Queue:** Gaps auto-queue until `/vic:research` runs
5. **Grow:** KB grows from real questions in your project

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol
- `zod` — Input validation

## Updates

Keep up-to-date: [agents/claude/update.md](agents/claude/update.md)

## License

MIT
