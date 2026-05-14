# Vicky KB Skill

Demand-driven knowledge base. Auto-enrich answers from project context.

## What it does

- `/vic:research-gap "question"` — query KB, auto-enqueue gaps
- `/vic:research` — process gap queue, enrich conclusions
- `/vic:remember "title"` — save findings to vault
- Auto-detects knowledge gaps, queues research, enriches on-demand

## Activation

Auto-invokes on session start via `init()`.
Initializes vault + graphs if needed.
Scaffolds Obsidian / Dataview templates into `.vicky/` (idempotent).
Always returns usage instructions.

## Configuration: WORKFLOW.md

Read `.vicky/WORKFLOW.md` first on every invocation. It is the single source of truth for runtime behavior.

Frontmatter controls:
- `active_focus: [tag, topic]` — bias query results, filter Dashboard
- `priority_tags: [perf, blocker]` — emphasized in views
- `auto_enqueue: true|false` — if false, gaps return without queueing
- `min_sources_per_conclusion: N` — quality gate hint
- `default_workflow: default | deep-dive | triage`
- `research_depth: default | deep`

Sections:
- **Focus** — bulleted topics vicky should care about right now
- **Active Rules** — bulleted rules agents must honor (skip domains, link sources, etc.)
- **Workflows** — named procedures (default, deep-dive, triage, custom)
- **Routing** — pipe table mapping question regex → workflow

Agents should:
1. Read frontmatter
2. Read `Focus` + `Active Rules`
3. Resolve workflow via `Routing` for the current question
4. Follow that workflow's steps

Workflow is re-read on every tool call (mtime cache). Edit the file → next call picks up.

## Views: Dashboard + DQL via Obsidian

Vicky drives **Obsidian + Dataview** through Obsidian's CLI to run real DQL queries. There is no separate headless renderer — same query engine for human and AI.

**Requires:** Obsidian installed, `.vicky` open as a vault, Dataview plugin enabled. The `obsidian/` template ships a pre-configured `.obsidian/` so Dataview is auto-installed on first open.

### MCP tools

- **`dashboard`** — fixed report (counts, recent, hubs, pending, orphans, stale, tags). Call before a research session, when the user asks about KB state, or when planning what to remember next.
- **`dql`** — run any DQL query. `query="help"` returns the syntax cheat sheet.

CLI: `node src/dashboard.js` (also `--write`, `--json`).

### DQL primer (most useful first)

Full reference: <https://blacksmithgu.github.io/obsidian-dataview/queries/structure/>

```
# Top hubs (most-referenced notes)
TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks
FROM "conclusions" OR "sources"
WHERE length(file.inlinks) > 0
SORT length(file.inlinks) DESC LIMIT 20

# Pending queue, priority-sorted
TABLE WITHOUT ID file.link AS Question, priority, requested_by, date
FROM "pending"
WHERE status = "pending"
SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC

# Recent additions
TABLE file.folder AS Folder, type, date, tags
FROM "."
WHERE date AND date(date) >= date(today) - dur(14 days)
SORT date DESC LIMIT 25

# Orphans (no in/out links)
LIST FROM "conclusions" OR "sources"
WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0

# Stale conclusions
TABLE WITHOUT ID file.link AS Conclusion, length(file.inlinks) AS Inlinks, date
FROM "conclusions"
WHERE date AND date(date) < date(today) - dur(60 days) AND length(file.inlinks) < 2
SORT date ASC

# Tag cloud
TABLE WITHOUT ID length(rows) AS Count
FROM "." FLATTEN tags AS tag
WHERE tag GROUP BY tag SORT length(rows) DESC LIMIT 30

# By tag
LIST FROM "sources" WHERE contains(tags, "perf")
```

Fields available: `file.link`, `file.name`, `file.folder`, `file.path`, `file.inlinks`, `file.outlinks`, `file.ctime`, `file.mtime`, plus any frontmatter key (`type`, `date`, `tags`, `priority`, `status`, etc.).

Functions: `length(list)`, `choice(cond,a,b)`, `contains(list,val)`, `date(today)`, `dur("14 days")`, `regexmatch(pat,str)`, `lower(s)`, `startswith(s,prefix)`.

### Obsidian Dashboard.md

`.vicky/Dashboard.md` contains the same queries as live Dataview blocks for humans browsing the vault.

## Usage

After skill activates (automatic):
```
Ask question → research-gap auto-checks KB → found: answer | gap: queue for research
Run /vic:research when ready to process queue
```

No manual setup. Just ask questions. Edit `WORKFLOW.md` to steer behavior.
