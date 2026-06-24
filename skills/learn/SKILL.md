---
description: Fully automatic KB building. Install vicky, run `/vicky:learn`, watch your knowledge grow. Tier-progressive drain (high-importance files first), auto-advancing between tiers. File monitors detect changes and auto-react (relink, relearn) — zero manual intervention. No external fetches, no stub conclusions — synthesis only via `conclude`. /vicky:research auto-feeds learn. Monitors also auto-trigger on pending growth or graph changes.
---

# Vicky Learn (Tier-Progressive with Monitors)

Fully automatic tier-progressive drain → sources → relink + monitor setup. Finds the highest unprocessed tier, drains it bit by bit, auto-advances. Pure DB walk; no web, no stubs. File monitors auto-trigger relink/relearn on dependent file changes.

Invoke: `/vicky:learn` (optionally: `count=50` to drain up to 50 notes instead of default 20)

## Automatic Tier-Progressive Processing

Pending notes are ranked by their connection to high-importance files (from AST analysis). Files are grouped into tiers:
- **Tier 0** = top 100 most-important files
- **Tier 1** = next 100 files
- etc.

On each run:
1. Detect the highest unprocessed tier (tier with indexed files < 100% OR any pending linked to it).
2. Drain pending linked to that tier (up to 20 notes, configurable).
3. If tier reaches 100% indexed, next call auto-advances to Tier 1.
4. Repeat until all tiers processed or pending queue empty.

No manual tier passing needed — **fully automatic**. Call `/vicky:learn` once per session or on a schedule; it finds the right tier and keeps going.

## Contract (what the tool guarantees)

For pending files in the current tier (or overflow):

1. **Promote to source** — write `vicky/sources/<slug>.md` with
   `type: source`, `tags: [source]`, body = question + context + graph
   context. Any existing source links from the pending stub end up as
   `related:` on the new source.
2. **Drop the pending stub.**
3. **Relink** — graphs rebuilt, `related:` frontmatter refreshed on sources + conclusions.
4. **Monitor dependent files** — create Claude Code monitors on:
   - `vicky/.graphify/graph.json` → auto-trigger relink on change
   - `vicky/.graphify/.graphify_ast.json` → auto-trigger re-analyze + learn on change
   - `vicky/pending/` → auto-trigger learn on file additions
   - `vicky/sources/` → auto-trigger relink on changes

**No conclusion is created.** Conclusions land in `vicky/conclusions/`
only when an agent has a real synthesis to write — via `conclude`
(direct) or `complete-research` (research/ promotion). Dashboard
"Sources awaiting synthesis" surfaces sources without an inbound conclusion.

Idempotent: if a source already exists for a pending slug, the pending
file is dropped without overwrite.

## File Monitors (Automatic)

When `/vicky:learn` completes, it instructs Claude Code to **create monitors** on dependent files:

```
/monitor create vicky/.graphify/graph.json \
  --on change --run "/vicky:relink"

/monitor create vicky/.graphify/.graphify_ast.json \
  --on change --run "/vicky:learn"

/monitor create vicky/pending/ \
  --on new-file --run "/vicky:learn"

/monitor create vicky/sources/ \
  --on change --run "/vicky:relink"
```

These monitors run continuously. When a dependent file changes, the monitor auto-triggers the next operation:
- Graph changes → auto-relink
- AST analysis updates → auto-learn (picks up next tier)
- Pending queue grows → auto-learn (drains new pending)
- Sources change → auto-relink

No manual `/vicky:learn` calls needed — the system is fully automatic. To temporarily disable: `/monitor pause vicky/`. To permanently remove: `/monitor delete vicky/`.

## Routing

`WORKFLOW.md → default_workflow: triage` filters drain to
`priority: high` pending notes only. Others stay queued.

## When to call

**Initial KB build:**
- Call `/vicky:learn` once to start Tier 0 processing
- Review sources + synthesize via `/vicky:conclude` between runs
- Call `/vicky:learn` again — auto-advances when Tier 0 done, starts Tier 1
- Repeat until progress stalls or KB is complete

**Ongoing (automatic):**
- Pending arrives (git pull, agents, cron) → monitors auto-trigger `/vicky:learn`
- Graph changes → monitors auto-trigger `/vicky:relink` 
- No manual calls needed if monitors active (set up by first `/vicky:learn` run)

**Manual call only when:**
- You've disabled monitors and want to manually drain the queue
- You want to force an immediate drain (don't wait for monitor interval)
- Testing or one-off cleanup

**Do NOT call** for single Q/A (use `research-gap`). **Do NOT call** when needing fresh external data — use `/vicky:research` (auto-calls learn after fetch).

## What to do after

`learn` leaves new sources without paired conclusions on purpose. Open
`Dashboard.md` (or call `dashboard`) and look at "Sources awaiting
synthesis": those are the candidates for the next `conclude` pass.
Read the source body, distil the takeaway, then call `conclude
title=<slug> sources=[<slug>, ...]`.

## State touched

- `vicky/pending/*.md`       deleted
- `vicky/sources/*.md`       added (promoted from pending)
- `vicky/graphs/*.json`      rebuilt
- `vicky/sources/*.md`       `related:` updated by relink
- `vicky/conclusions/*.md`   `related:` updated by relink

## Failure modes (handled by the tool)

- **Pending note missing `## Question`** — filename used as the question.
- **Slug collision** with existing source — pending dropped, no overwrite.
- **graphifyy dep missing** — relinking falls back to existing graphs;
  promotion still runs.
