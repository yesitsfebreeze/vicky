# Vicky

Demand-driven knowledge base MCP server. Auto-enriches answers when gaps detected. Drives Obsidian + Dataview for live KB views.

## What it does

- Local KB of sources + conclusions, queried by your agent
- Detects gaps in your question, auto-enqueues research
- Processes the queue when you ask, enriches conclusions
- Exposes Dataview (DQL) directly to the agent for arbitrary KB queries
- Ships an Obsidian vault preset (Dataview pre-configured)

## Requirements

- Node.js 18+
- [Obsidian](https://obsidian.md) (for `dashboard` / `dql` tools)
- Any MCP-capable agent (Claude Code, Claude API, Cursor, etc.)
- LLM API key for graphify's semantic pass (see [LLM API key](#llm-api-key) below)

> `graphify` ships as a bundled dependency ([graphifyy](https://www.npmjs.com/package/graphifyy) on npm). `npm install` pulls it in — no external install needed. Vicky resolves the local binary at runtime.

## Install

### Claude Code (plugin)

```
/plugin marketplace add yesitsfebreeze/vicky
/plugin install vicky@vicky
```

Registers the MCP server, hooks `init()` to SessionStart, and exposes the `vicky` skill. First session scaffolds `vicky/{sources,conclusions,pending,graphs}` plus the Obsidian preset (`.obsidian/`, `Dashboard.md`, `WORKFLOW.md`, folder indexes).

### Any other MCP-capable agent

```bash
git clone https://github.com/yesitsfebreeze/vicky ~/vicky
cd ~/vicky/src && npm install && npm run build
```

Register the MCP server pointing at `~/vicky/dist/index.js`. Example `.mcp.json`:

```json
{
  "mcpServers": {
    "vicky": {
      "command": "node",
      "args": ["~/vicky/dist/index.js"]
    }
  }
}
```

Restart the agent. First call triggers `init()`. Open `vicky/` in Obsidian and enable Dataview (the preset auto-installs it on first open).

## Update

```bash
cd ~/vicky && git pull && cd src && npm install && npm run build
```

Restart the agent so the MCP server reloads. `vicky/` is yours — `init()` never overwrites existing files.

## Tools (MCP)

| Tool | Purpose |
|------|---------|
| `research-gap "q"` | Query KB; auto-enqueue if gap |
| `research`         | Drain pending queue → conclusion stubs |
| `query "q"`        | Direct KB lookup (focus-biased) |
| `remember "title"` | Save findings to vault |
| `enqueue "q"`      | Manual queue add |
| `dashboard`        | KB report via Obsidian + Dataview |
| `dql "<query>"`    | Run arbitrary DQL. `query="help"` for syntax |
| `relink`           | Rebuild link graph |
| `web-search`       | Web research helper |

## Layout

```
~/vicky/                     # plugin root (clone target)
├── .claude-plugin/          # plugin manifest
├── hooks/                   # SessionStart init hook
├── dist/                    # bundled MCP server (CI-built, committed)
├── scaffold/                # template tree mirroring project root (copied to . on init)
├── skills/                  # Claude Code skills
├── src/                     # source + build (node_modules lives here)
│   ├── package.json
│   ├── build.js
│   ├── index.js, init.js, dashboard.js, ...
│   └── tools/
└── README.md                # this file

<your project>/vicky/       # created by init() in each project
├── sources/                 # external research, papers
├── conclusions/             # synthesized knowledge
├── pending/                 # queued research questions
├── .graphify/               # graphify state — graph.json (semantic, BFS target)
├── graphs/                  # Dataview-queryable wiki: vicky.md + cluster pages
├── .graphifyignore          # extract scope (excludes pending/, .obsidian/, etc.)
├── .obsidian/               # Obsidian vault config (Dataview enabled)
├── WORKFLOW.md              # focus, rules, routing (edit to steer Vicky)
└── Dashboard.md             # live Dataview views
```

## WORKFLOW.md

Single source of truth for runtime behavior. Edit frontmatter:

```yaml
active_focus: [perf, nanite]      # bias query results + Dashboard
priority_tags: [blocker]
auto_enqueue: true                # false = gaps don't auto-queue
default_workflow: default         # default | deep-dive | triage
```

Sections: `Focus`, `Active Rules`, `Workflows`, `Routing` (regex → workflow). Re-read on every tool call.

## Dataview / DQL

Vicky drives `obsidian.exe eval` to run real DQL inside Obsidian's Dataview plugin. Same engine as the human-facing Dashboard.md, no separate renderer.

Full DQL reference: <https://blacksmithgu.github.io/obsidian-dataview/queries/structure/>

Top queries the agent uses:

```
# Hubs (most-referenced)
TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks
FROM "conclusions" OR "sources"
WHERE length(file.inlinks) > 0
SORT length(file.inlinks) DESC LIMIT 20

# Pending queue, priority-sorted
TABLE WITHOUT ID file.link AS Q, priority, requested_by, date
FROM "pending"
WHERE status = "pending"
SORT choice(priority="high",0,choice(priority="med",1,2)) ASC

# Recent additions
TABLE date, type, tags FROM "."
WHERE date AND date(date) >= date(today) - dur(14 days)
SORT date DESC LIMIT 25

# Orphans
LIST FROM "conclusions" OR "sources"
WHERE length(file.inlinks)=0 AND length(file.outlinks)=0
```

## LLM API key

Vicky's `relink` shells out to the bundled `graphifyy` CLI, which needs an LLM key for the semantic extraction pass. Without one, `relink` falls back to AST-only edges and most files end up orphaned in the graph.

Vicky reads no key itself — set the env var that graphify expects, in the **OS user environment**, so the subprocess inherits it.

| Backend  | Env var(s)                              | Get key |
|----------|-----------------------------------------|---------|
| gemini   | `GEMINI_API_KEY` or `GOOGLE_API_KEY`    | <https://aistudio.google.com/apikey> |
| openai   | `OPENAI_API_KEY`                        | <https://platform.openai.com/api-keys> |
| claude   | `ANTHROPIC_API_KEY`                     | <https://console.anthropic.com/settings/keys> |
| kimi     | `MOONSHOT_API_KEY`                      | <https://platform.moonshot.cn/console/api-keys> |
| ollama   | `OLLAMA_API_KEY` + `OLLAMA_BASE_URL`    | local, any non-empty value |

Auto-pick order if multiple set: `GEMINI_API_KEY → GOOGLE_API_KEY → MOONSHOT → ANTHROPIC → OPENAI`. Force a backend with `graphify extract . --backend <name>`.

### Setting the key

**Windows (PowerShell, persistent, no admin):**

```powershell
[Environment]::SetEnvironmentVariable('GEMINI_API_KEY', '<your-key>', 'User')
# Restart the agent — User env vars don't propagate into running processes.
```

**macOS / Linux (zsh/bash):**

```bash
echo 'export GEMINI_API_KEY="<your-key>"' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc
```

Verify:

```bash
graphify extract vicky/sources --backend gemini
```

> Do **not** put the key in `vicky/`, `vicky.config.json`, or any tracked file. It won't be read, and you risk leaking it via git.

## Env overrides

| Var               | Default                     | Use |
|-------------------|-----------------------------|-----|
| `VICKY_ROOT`      | `vicky`                    | Move vault outside CWD |
| `OBSIDIAN_EXE`    | `obsidian` (from PATH)      | Override Obsidian binary |
| `OBSIDIAN_VAULT`  | basename of `VICKY_ROOT`    | Override registered vault name |
| `GEMINI_API_KEY`  | —                           | graphify semantic extraction (see above) |
| `GRAPHIFY_FORCE`  | `0`                         | Overwrite graph even if rebuild shrinks node count |

## License

MIT.
