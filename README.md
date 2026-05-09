# Vicky MCP Plugin

Demand-driven knowledge base. Auto-enriches project answers when gaps detected.

## What it does

- Queries local KB (conclusions + sources graphs)
- Auto-detects gaps
- Auto-enqueues web research
- Enriches conclusions on-demand
- Zero setup needed

## Install

**Local (recommended):**
```bash
cp -r ~/dev/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

**Or git-based:**
Add to `~/.claude/settings.json`:
```json
{
  "extraKnownMarketplaces": {
    "vicky": {
      "source": {
        "source": "github",
        "repo": "sayhe/vicky"
      }
    }
  }
}
```

**Verify:**
1. Restart Claude Code
2. Open project
3. SessionStart hook → auto-init
4. Run: `/vic:research-gap "test"`

## Usage

Ask a question → `/vic:research-gap "question"` auto-runs
- **Found?** Returns KB context
- **Gap?** Auto-enqueues research

Run `/vic:research` to process gaps → enriches KB for next time.

## Tools

| Tool | Purpose |
|------|---------|
| `/vic:research-gap "q"` | Query KB, auto-enqueue gaps |
| `/vic:research` | Process gap queue, enrich conclusions |
| `/vic:remember "title"` | Save findings to vault |
| `/vic:enqueue "q"` | Manual queue (usually auto-done) |

## How it works

1. SessionStart hook calls `init()` → creates vault if missing
2. Skill auto-available with usage instructions
3. MCP research-gap is default query interface
4. Questions check KB automatically
5. Gaps accumulate until `/vic:research` processes them
6. Knowledge base grows from failures, not noise

No external config needed. No CLAUDE.md dependency. Just works.

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
