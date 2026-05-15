---
description: Walk the KB and connect what is already there. Drains the pending queue into sources and rebuilds the graph. No external fetches, no stub conclusions — conclusions are only born from real synthesis via `conclude` / `complete-research`. For new external data use /vicky:research, which calls this skill at the end of its own pipeline. Use /vicky:learn on its own when pending notes arrived from elsewhere (git pull, sibling agents, cron) and just need absorbing.
---

# Vicky Learn

Drain pending → sources → relink. Pure DB walk; no web, no stubs.
The transitions are enforced in code (`learn` MCP tool), not in this
document.

Invoke: `/vicky:learn`

## Contract (what the tool guarantees)

For every file in `.vicky/pending/`:

1. **Promote to source** — write `.vicky/sources/<slug>.md` with
   `type: source`, `tags: [source]`, body = question + context + graph
   context. Any existing source links from the pending stub end up as
   `related:` on the new source.
2. **Drop the pending stub.**
3. **Relink** — graphs rebuilt, `related:` frontmatter refreshed on every
   note across sources and conclusions.

**No conclusion is created.** Conclusions land in `.vicky/conclusions/`
only when an agent has a real synthesis to write — via `conclude`
(direct) or `complete-research` (research/ promotion). The dashboard
"Sources awaiting synthesis" section surfaces sources without an
inbound conclusion so the work is visible.

Idempotent: if a source already exists for a pending slug, the pending
file is dropped without overwrite.

## Routing

`WORKFLOW.md → default_workflow: triage` filters the drain to
`priority: high` pending notes only. Other priorities stay queued.

## When to call

- Pending queue grew from sibling agents, `git pull`, or cron and you
  want it absorbed before querying.
- Periodic catch-up — once per session, or external schedule.
- After bulk `enqueue` calls outside `/vicky:research`.

Do not call for an individual question the KB might already answer
(use `research-gap`). Do not call when you also need fresh external
data — use `/vicky:research`, which fetches and then invokes learn
automatically.

## What to do after

`learn` leaves new sources without paired conclusions on purpose. Open
`Dashboard.md` (or call `dashboard`) and look at "Sources awaiting
synthesis": those are the candidates for the next `conclude` pass.
Read the source body, distil the takeaway, then call `conclude
title=<slug> sources=[<slug>, ...]`.

## State touched

- `.vicky/pending/*.md`       deleted
- `.vicky/sources/*.md`       added (promoted from pending)
- `.vicky/graphs/*.json`      rebuilt
- `.vicky/sources/*.md`       `related:` updated by relink
- `.vicky/conclusions/*.md`   `related:` updated by relink

## Failure modes (handled by the tool)

- **Pending note missing `## Question`** — filename used as the question.
- **Slug collision** with existing source — pending dropped, no overwrite.
- **graphifyy dep missing** — relinking falls back to existing graphs;
  promotion still runs.
