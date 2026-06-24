# Vicky Quick Start

**Install vicky, run `/vicky:learn`, watch your KB grow automatically.**

## Installation

### Claude Code (easiest)

```
/plugin marketplace add yesitsfebreeze/vicky
/plugin install vicky@vicky
```

Vicky scaffolds the vault structure automatically on first run.

### Manual MCP Registration

```bash
git clone https://github.com/yesitsfebreeze/vicky ~/vicky
cd ~/vicky/src && npm install && npm run build
```

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "vicky": {
      "command": "node",
      "args": ["~/vicky/dist/vicky.js"]
    }
  }
}
```

## First Run

```
/vicky:learn
```

That's it. Watch the dashboard to see your KB grow:

```
/vicky:dashboard
```

Or open `vicky/Dashboard.md` in Obsidian for live stats.

## How It Works

1. **`/vicky:learn`** analyzes your codebase (AST + git history) to identify high-value files
2. Tier-progressive indexing: high-importance files (Tier 0) before lower (Tier 1, 2, ...)
3. **File monitors** auto-trigger next steps:
   - Graph changes → auto-relink
   - New pending arrives → auto-learn (next tier)
   - Pending filled → sources created + relinked
4. Repeat until KB is complete

## Everyday Commands

| Command | When | Effect |
|---------|------|--------|
| `/vicky:learn` | Once per session, or when you want to check progress | Find next unprocessed tier, drain pending, advance |
| `/vicky:research "<topic>"` | You need fresh sources on a topic | Fetch + enqueue → learn absorbs it |
| `/vicky:query "<q>"` | Quick KB lookup | Search sources + conclusions |
| `/vicky:dashboard` | Check KB health | Live stats: sources, conclusions, pending, coverage by tier |
| `/monitor list` | See what's watching | List active file monitors |

## Monitors

Once `/vicky:learn` runs, **file monitors activate automatically**:

```
vicky/.graphify/graph.json    → auto-relink on change
vicky/pending/                → auto-learn on new files
vicky/sources/                → auto-relink on change
```

You don't manage these — they just work. If you need to pause (e.g., bulk refactor):

```
/monitor pause vicky/
# ... do your bulk work ...
/monitor resume vicky/
```

## Synthesis (Optional)

After sources are created, synthesize them into conclusions:

```
/vicky:dashboard
```

Look for "Sources awaiting synthesis" → read each source → call:

```
/vicky:conclude title="Your takeaway" sources=[source-slug-1, source-slug-2]
```

This is manual (requires real thinking) but optional — you can query the KB without conclusions.

## Configuration

Create `vicky.config.json` in your project root to customize:

```json
{
  "fileMonitor": {
    "enabled": true,
    "intervalMs": 10000
  }
}
```

See `/Users/feb/vicky/docs/vicky.config.example.json` for all options.

## Troubleshooting

**KB not growing?**
- Run `/vicky:learn` — it builds sources from pending
- Check `/vicky:dashboard` — shows tier coverage
- Ensure `.graphify/` analysis is complete: `graphify extract .`

**Monitors not triggering?**
- Run `/monitor list` — are monitors active?
- Check that files are actually changing (small edits might not trigger)
- Pause/resume: `/monitor pause vicky/` then `/monitor resume vicky/`

**Graph looks empty?**
- You need an LLM key for semantic analysis (graphify). Set `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` in your shell.
- Without a key, AST-only graph builds (entities connected, but sparse).

## Next Steps

- Read [WORKFLOW.md](../vicky/WORKFLOW.md) to customize focus, rules, and routing
- See [FILE_MONITORING.md](MONITORS.md) for advanced monitor usage
- Check [SKILL.md](../skills/learn/SKILL.md) for detailed learn internals
