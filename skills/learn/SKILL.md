---
description: Walk the KB and connect what is already there. Drains the pending queue into sources + conclusions, derives stub conclusions for newly discovered topics, and rebuilds the graph. No external fetches — for that, use /vicky:research, which calls this skill at the end of its own pipeline. Use /vicky:learn on its own when pending notes arrived from elsewhere (git pull, sibling agents, cron) and just need absorbing.
---

# Vicky Learn

Drain pending → sources → conclusions → relink. Pure DB walk; no web.
The transitions are enforced in code (`learn` MCP tool), not in this
document.

Invoke: `/vicky:learn`

## Contract (what the tool guarantees)

For every file in `.vicky/pending/`:

1. **Promote to source** — write `.vicky/sources/<slug>.md` with
   `type: source`, `tags: [source]`, body = question + context + graph
   context. Any existing source links from the pending stub end up as
   `related:` on the new source.
2. **Derive conclusion** — write `.vicky/conclusions/<slug>.md` with
   `type: conclusion`, `tags: [conclusion]`, `sources: [[<source-slug>]] + linked source titles`
   in both frontmatter and a `## Sources` body block.
3. **Drop the pending stub.**
4. **Relink** — graphs rebuilt, `related:` frontmatter refreshed on every
   note across sources and conclusions.

Idempotent: if a conclusion already exists for a pending slug, the
pending file is dropped without re-running the promotion.

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

`learn` produces stub conclusions linked to fresh sources. The
synthesis text (`_derived from pending — fill in synthesis_`) is a
placeholder. Open `Dashboard.md` or call `dashboard` to see the new
hubs and orphans, then fill in the conclusion bodies as you read the
sources.

## State touched

- `.vicky/pending/*.md`       deleted
- `.vicky/sources/*.md`       added (promoted from pending)
- `.vicky/conclusions/*.md`   added (derived from new sources)
- `.vicky/graphs/*.json`      rebuilt
- `.vicky/sources/*.md`       `related:` updated by relink
- `.vicky/conclusions/*.md`   `related:` updated by relink

## Failure modes (handled by the tool)

- **Pending note missing `## Question`** — filename used as the question.
- **Slug collision** with existing conclusion — pending dropped, no overwrite.
- **graphifyy dep missing** — relinking falls back to existing graphs;
  promotion still runs.
