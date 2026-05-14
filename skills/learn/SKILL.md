---
description: Drain the pending queue into the KB. One call promotes every pending note into a source, derives a conclusion linked to it, and rebuilds graphs. Use /vicky:learn after a /vicky:research pass, when the queue has grown, or on a schedule. Contract-enforced — the underlying `research` MCP tool guarantees the transitions, no procedural instructions to follow.
---

# Vicky Learn

Drain pending → sources → conclusions → relink. The transitions are
enforced in code (`research` MCP tool), not in this document.

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

- After `/vicky:research` enqueued follow-up questions
- When the pending queue grows past `researchQueueProcessThreshold`
- After `git pull` that brought new pending notes
- Periodic — once per session, or external cron

Do not call learn for an individual question — use `research-gap` for
that path.

## What to do after

`/vicky:learn` produces stub conclusions linked to fresh sources. The
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

- **Pending note missing `## Question`** — filename is used as the question.
- **Slug collision** with existing conclusion — pending dropped, no overwrite.
- **graphify CLI missing** — relinking falls back to existing graphs; promotion still runs.
