# Vicky MCP Plugin

Demand-driven knowledge base. Auto-enriches project answers when gaps detected.

Tell your Agent to:
```
install https://raw.githubusercontent.com/yesitsfebreeze/vicky/main/README.md
```

## What it does

- Queries local KB (conclusions + sources graphs)
- Auto-detects gaps
- Auto-enqueues web research
- Enriches conclusions on-demand
- Zero setup needed

## Install

**Prerequisites:** Node.js 18+, npm 9+

**Setup:**
```bash
git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
cat > .claude-plugin << 'EOF'
{
  "name": "vicky",
  "version": "0.2.0",
  "mcp": {
    "command": "node",
    "args": ["src/index.js"]
  }
}
EOF
```

**Verify:**
1. Restart Claude Code
2. Open project in Claude Code
3. Test: `mcp__vicky__research_gap "What is adaptive subdivision?"`

## Usage

Call MCP tools directly in any Claude Code prompt:

```
mcp__vicky__research_gap "What is Phase 5 subdivision?"
```

- **Found?** Returns KB context + sources
- **Gap?** Auto-enqueues research

Process gaps when ready:
```
mcp__vicky__research
```

Save findings:
```
mcp__vicky__remember "Subdivision key insights"
```

## Tools

| Tool | Purpose |
|------|---------|
| `mcp__vicky__research_gap "q"` | Query KB, auto-enqueue gaps |
| `mcp__vicky__research` | Process gap queue, enrich conclusions |
| `mcp__vicky__remember "title"` | Save findings to vault |
| `mcp__vicky__query "q"` | Direct KB lookup |
| `mcp__vicky__enqueue "q"` | Manual queue |

## How it works

1. Agent-specific install (see `INSTALL.md` for your agent)
2. MCP server registered → auto-loads on session start
3. Call `mcp__vicky__research_gap "question"` directly
4. Vicky checks local KB (`.vicky/conclusions/`)
   - Found? → Return context + sources
   - Gap? → Auto-queue in `.vicky/pending/`
5. Run `mcp__vicky__research` to process queue
6. Tools enrich KB for future questions

Zero setup. Just call MCP tools directly.

## Agent-Specific Installation

Each agent has its own install script:
- **Claude Code:** See `agents/claude/INSTALL.md`
- **Claude API:** See `agents/api/INSTALL.md`
- **Other agents:** See `INSTALL.md` (generic guide)

## Architecture

```
.vicky/
├── sources/           # Web research, papers, external docs
├── conclusions/       # Synthesized knowledge
├── pending/           # Queued research questions
└── graphs/            # Knowledge graphs
```

## Requirements

- Node.js 18+
- Graphify CLI (optional, for code graph extraction)
