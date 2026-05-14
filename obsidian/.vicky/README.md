# Obsidian views for Vicky

Templates + Dataview queries to view a vicky KB as an Obsidian vault.

## Files

- `WORKFLOW.md` — config entry point. Focus, rules, workflows, routing. Edit to steer vicky.
- `Dashboard.md` — top-level live views (recent, hubs, pending, orphans, focus).
- `sources/_index.md` — sources views.
- `conclusions/_index.md` — conclusion hub ranking + thin/orphan detection.
- `pending/_index.md` — queue by priority / age / requester.

## Setup

`.obsidian/` config ships with this template — `init()` copies it to `.vicky/.obsidian/`, so Obsidian recognizes `.vicky/` as a vault immediately and Dataview JS queries are pre-enabled.

1. Open `.vicky/` as an Obsidian vault (File → Open folder as vault).
2. First open: Obsidian prompts to install [Dataview](https://github.com/blacksmithgu/obsidian-dataview) from the community-plugins.json list. Install + enable. Settings (JS queries on) already configured.
3. Open `Dashboard.md`.

## Data model

Vicky writes frontmatter on every save:

```yaml
title: <slug>
date: YYYY-MM-DD
type: source | research | research-pending | workflow | dashboard | index
tags: [a, b]
status: pending           # pending notes only
priority: high|med|low    # pending notes only
requested_by: <agent>     # pending notes only
sources: ["[[link]]"]     # set by relink
related: ["[[link]]"]     # set by relink
```

Dataview queries in `Dashboard.md` and the `_index.md` files use these fields.

## WORKFLOW.md as config

Frontmatter on `WORKFLOW.md` controls behavior:

```yaml
active_focus: [nanite, gpu-culling]   # filter views + bias query results
priority_tags: [perf, blocker]
research_depth: deep                  # default | deep
auto_enqueue: true                    # false = gaps return without writing pending
min_sources_per_conclusion: 2
default_workflow: default             # default | deep-dive | triage
```

The `Routing` table maps question regex → workflow.

Agents should read `WORKFLOW.md` first on every invocation and honor it.

## CLI (drives Obsidian + Dataview)

```bash
node src/dashboard.js            # markdown report to stdout
node src/dashboard.js --write    # writes .vicky/Dashboard.report.md
node src/dashboard.js --json     # raw Dataview output
```

MCP tools: `dashboard` (fixed report) and `dql` (arbitrary DQL). Both shell out to `obsidian.exe vault=.vicky eval code=…` which calls the Dataview API in the running Obsidian process. Requires Obsidian running with the vault open and Dataview enabled. Override exe path with `OBSIDIAN_EXE`, vault name with `OBSIDIAN_VAULT`.
