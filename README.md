# Vicky KB Plugin

Demand-driven knowledge base for coding agents. Auto-enriches answers when gaps detected.

Tell your Agent to:
```
install https://raw.githubusercontent.com/yesitsfebreeze/vicky/main/INSTALL.md
update https://raw.githubusercontent.com/yesitsfebreeze/vicky/main/UPDATE.md
```

## What it does

- Query local KB (conclusions + sources)
- Auto-detect knowledge gaps
- Auto-enqueue web research
- Enrich conclusions on-demand
- Zero config, zero setup

## Installation

See [INSTALL.md](INSTALL.md) for multiple installation methods:
- Clone from GitHub
- Copy from local dev
- Manual setup
- Minimal tools (curl + tar)

Choose the method that fits your setup. Requires Node.js 18+ and npm.

## Update

Keep Vicky current. See [UPDATE.md](UPDATE.md) for:
- Updating via git
- Rolling back to a specific commit
- Troubleshooting update issues

## Usage

### Commands
- `/vic:research-gap "question"` — Query KB → found: return context | gap: auto-enqueue research
- `/vic:research` — Process pending gaps, enrich KB
- `/vic:remember "title"` — Save findings to vault (auto-callable after web search)
- `/vic:enqueue "question"` — Manual queue (usually auto-done)
- `/vic:relink` — Rebuild knowledge graph links

### Workflow
1. **Ask a question** (any question in your work)
2. **Vicky auto-checks KB** via `research-gap` tool
   - Found? → Returns answer + sources
   - Gap? → Auto-queues for research
3. **Run `/vic:research`** when ready (or manually via `/vic:web-search`)
4. **After web search**, call `/vic:remember` with findings
5. **Next time**, same question returns from KB

## Architecture

```
.vicky/                   # Auto-created in project root
├── sources/              # Markdown files from web research
├── conclusions/          # Synthesized KB (queries + links)
├── pending/              # Queued research questions
└── graphs/               # JSON knowledge graphs (requires graphify)
```

## Requirements

- **Node.js** 18+
- **graphify CLI** (optional, for enhanced KB querying)
  - Install: `npm install -g @anthropics/graphify`
  - Without it: plugin still works via text search fallback

## How it works

1. On session start: Hook runs `init.mjs` → creates `.vicky/` structure
2. Skill registers commands: `/vic:*` prefix
3. MCP server provides 7 tools
4. Questions auto-check KB (no manual invocation needed)
5. Gaps auto-queue until you run `/vic:research`
6. KB grows from real questions, not busywork

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol
- `zod` — Input validation

## License

MIT
