---
description: Continuous KB-improvement loop. Drains the pending research queue into conclusion stubs, refreshes link graphs, and updates the `related:` frontmatter. Use /vicky:learn after a research burst, when the user wants Vicky to "catch up" on accumulated questions, or on a schedule. Honors WORKFLOW.md routing (triage mode filters to high priority).
---

# Vicky Learn

Continuous KB improvement. Walks `.vicky/pending/`, turns each pending question into a `.vicky/conclusions/` stub with graph context, rebuilds the source + conclusion graphs, and writes `related:` wikilinks back into every note.

Invoke: `/vicky:learn`

## What the loop does (one pass)

1. **Read WORKFLOW.md** — pick up `default_workflow` and `priority_tags`. If `default_workflow: triage`, only `priority: high` pending notes are drained this pass.
2. **Drain pending → conclusion stubs**
   - For each `.vicky/pending/<slug>.md`:
     - Skip if `.vicky/conclusions/<slug>.md` already exists (idempotent).
     - Read `## Question` + `## Context` from the pending note.
     - Query the sources graph for related context.
     - Write `.vicky/conclusions/<slug>.md` with frontmatter (`type: conclusion`, `tags: [conclusion]`), embed the graph context as a `## Graph Context` block. The `research` tag is dropped on transition — pending notes use `tags: [research, pending]`, but once drained into a conclusion the artefact is no longer pending so its tag changes accordingly.
     - Delete the pending note.
3. **Discover topics** — sample titles from the sources graph that don't yet have a matching conclusion, create `_stub_` conclusion files for the top N (default 10) so they show up in the dashboard's `Orphans` view for follow-up.
4. **Relink** — run `update_src` + `update_con` via graphify, then `relink_dir` on both sources and conclusions. This writes the `related:` frontmatter block on every note from inbound graph links.
5. **Notify** — emit a single MCP `info` notification summarising counts: drained, new stubs, relinked.

## When to call

| Trigger | Why |
|---------|-----|
| User asks "catch up on research" / "process the queue" | Direct call |
| Pending queue grows past `researchQueueProcessThreshold` | Background trigger (config in vicky.config.json) |
| After a `/vicky:research` session that enqueued follow-ups | New questions are ready to drain |
| Periodic — once at end of session, or via external cron | Keep KB fresh |

Do **not** call learn for every user question. It's a batch operation. Use `research-gap` for individual questions.

## Implementation

The skill is a thin orchestrator over the existing MCP tool:

```
research                # drains pending, discovers topics, relinks
```

Or, for finer control:

```
relink                  # rebuild graphs + related: frontmatter only, no drain
```

Both run asynchronously in the background — the tool returns immediately, then emits notifications as work completes.

## State touched

- `.vicky/pending/*.md`     deleted after drain
- `.vicky/conclusions/*.md` new stubs + frontmatter updates
- `.vicky/sources/*.md`     `related:` frontmatter updated
- `.vicky/graphs/*.json`    rebuilt

Never overwrites a note's body — only frontmatter blocks (`related:`, `sources:`).

## Reading the result

After learn runs, call `dashboard` to see:
- **Pending queue** — should be empty (or only `triage`-skipped low-priority entries)
- **Recent additions** — new conclusion stubs
- **Hubs** — updated inlink counts reflect new relinking
- **Orphans** — stubs without graph hits land here, candidates for `/vicky:research`

## Triage mode

When `.vicky/WORKFLOW.md` has:

```yaml
default_workflow: triage
```

`/vicky:learn` only drains pending notes with `priority: high`. Med/low stay queued for a later non-triage pass. Useful when the queue is large and you want signal-first processing.

## Failure modes

- **graphify CLI missing** — relinking is skipped, drain still runs. Install graphify to enable graph queries.
- **Pending note missing `## Question`** — falls back to filename as the question.
- **Conclusion stub conflict** (slug already exists) — pending note deleted, no overwrite.
