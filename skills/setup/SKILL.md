---
description: Vicky knowledge-base context primer. Loaded automatically on every session start. Tells Claude which MCP tools Vicky exposes, how WORKFLOW.md steers behavior, when to call dashboard/dql, and the active vault layout. Invoke manually with /vicky:setup if context has been compacted away.
---

# Vicky Setup

Loaded automatically at SessionStart. Re-invoke `/vicky:setup` after `/compact` to restore Vicky context.

## What Vicky provides

A demand-driven KB stored in `.vicky/`. Conclusions and sources are markdown notes linked with `[[wikilinks]]`. An Obsidian vault preset (Dataview pre-enabled) ships with the plugin and is scaffolded into `.vicky/` on first init.

## MCP tools

| Tool | Use when |
|------|----------|
| `research-gap "<question>"` | Default for any knowledge question. Returns KB context if found, auto-enqueues research when there's a gap. Honors `WORKFLOW.md → auto_enqueue`. |
| `query "<question>"`        | Direct KB lookup, no auto-enqueue. Focus-biased per WORKFLOW.md. |
| `research`                  | Drain the pending queue into conclusion stubs. `triage` workflow filters to `priority: high`. |
| `remember title content`    | Save findings to `.vicky/sources/` with frontmatter. |
| `enqueue "<question>"`      | Manually queue a research question. |
| `relink`                    | Rebuild link graphs + `related:` frontmatter. |
| `dashboard`                 | Vault overview (counts, hubs, pending, orphans, stale, tags) via Obsidian + Dataview. Call before research sessions and when the user asks about KB state. |
| `dql "<query>"`             | Run arbitrary DQL. `query="help"` returns syntax reference + examples. Use for ad-hoc questions the fixed dashboard doesn't answer. |
| `web-search`                | Drive external research when KB has no answer. |

## WORKFLOW.md — single source of truth

Read `.vicky/WORKFLOW.md` once at session start, again whenever a tool result references a workflow.

Frontmatter keys that affect runtime:
- `active_focus: [tag, topic]` — biases query results, filters dashboard `By focus` section
- `priority_tags: [perf, blocker]` — emphasised in views
- `auto_enqueue: true|false` — when false, gaps are reported without being queued
- `default_workflow: default | deep-dive | triage` — `triage` makes `research` only drain `priority: high` pending notes
- `min_sources_per_conclusion: N` — quality gate hint

Sections:
- `Focus` — what Vicky cares about right now (bullets)
- `Active Rules` — rules every tool call must honour
- `Workflows` — named procedures
- `Routing` — pipe table mapping question regex → workflow

Edits to `WORKFLOW.md` are picked up on the next tool call (mtime cache).

## Dashboard + DQL prerequisites

`dashboard` and `dql` shell out to `obsidian.com vault=<name> eval` and require:

1. Obsidian installed (PATH or `OBSIDIAN_CLI` env var)
2. The vault open in a running Obsidian instance (the plugin's preset auto-enables Dataview on first open)
3. Dataview plugin loaded

If `dashboard` errors with "Obsidian is not running with the vault \"...\" open", instruct the user to open the vault in Obsidian first. Do not retry indefinitely — the 10s timeout is intentional.

## Default behaviour for Claude

- Knowledge questions → start with `research-gap`
- "What's in the vault?" / activity questions → `dashboard`
- Ad-hoc structural queries (find all sources with tag X, recently-touched conclusions, etc.) → `dql`
- New finding worth keeping → `remember`
- After a research burst → `relink` to refresh the graph

Do not call `research` reactively for every question — it drains the queue and is expensive. Run it when the user asks, when the queue has accumulated, or per `WORKFLOW.md → default_workflow`.

## Vault layout (created by init)

```
.vicky/
├── sources/      external research, papers, web findings
├── conclusions/  synthesised knowledge
├── pending/      queued research questions
├── graphs/       link graphs (sources.json, conclusions.json)
├── .obsidian/    Dataview-enabled vault config
├── WORKFLOW.md   focus + rules + routing (edit to steer)
└── Dashboard.md  live Dataview views
```
