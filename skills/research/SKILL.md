---
description: Get new data into the KB. Web-searches the topic, attaches findings to a pending stub, then auto-calls the `learn` MCP tool so the new material is promoted to a source and relinked. Conclusions are written separately via `conclude` once you have a real takeaway. Use /vicky:research "<topic>" when the KB has a gap on a specific subject.
---

# Vicky Research

Fetch new external data, hand it to `learn`. The user gets one verb,
`research`, and the queue drains as a side effect.

Invoke: `/vicky:research "<topic>"`

Example: `/vicky:research "GPU-driven indirect draw stream compaction"`

## Contract

1. **Gap check** — call `research-gap "<topic>"`. If the KB already
   answers it, surface that and stop (unless the user asked for a refresh).
2. **Enqueue pending** — call `enqueue question="<topic>" priority=med
   sources=[<any KB sources that mention it>]`. Writes
   `vicky/pending/<slug>.md` with `tags: [research, pending]` and a
   `sources:` frontmatter block linking to upstream notes.
3. **Web search** — call `web-search "<topic>"`. For each high-signal
   result, append a `## Sources` entry to the pending note: title, URL,
   author, date, key passages quoted verbatim. Reject paywalls,
   off-topic, link-farm pages. Dedupe by canonical URL.
4. **Extract follow-ups** — for each unresolved sub-question, call
   `enqueue question="<follow-up>" requested_by=research
   sources=[<topic-slug>]`. Tag jargon → "what is X?" follow-ups,
   conflicting claims → "reconcile X vs Y".
5. **Absorb** — call the `learn` MCP tool. It drains the pending stub
   into `vicky/sources/<slug>.md` and relinks. No conclusion is created
   here — that step is for the caller, once a real synthesis exists.
   Mandatory — research without learn leaves orphan pending stubs.
6. **Synthesise (optional, recommended)** — read the new source, then
   call `conclude title="<slug>" sources=[<slug>, ...]` with the
   takeaway. Skip only if the source data is too thin to draw a
   conclusion yet; the dashboard's "Sources awaiting synthesis" section
   will surface it later.

## When to call

- User: `research <topic>`
- A `research-gap` came back as a gap and the user wants fresh sources
- Topic in `WORKFLOW.md → priority_tags` is under-sourced

Do not call for questions the KB already answers (use `query` or
`research-gap`). Do not call for bulk drain with no new fetch
(use `/vicky:learn` directly).

## Quality gates

- `min_sources_per_conclusion` (WORKFLOW.md, default 2) — if fewer
  high-signal sources survive scoring, mark the pending stub
  `confidence: low` in frontmatter and ask the user to retry / abort.
- Reject sources older than 3 years for fast-moving fields unless the
  topic is foundational.

## State touched

- `vicky/pending/*.md`       topic stub + follow-ups (created, drained by step 5)
- `vicky/sources/*.md`       added by step 5
- `vicky/conclusions/*.md`   added by step 6 if you call `conclude`
- `vicky/graphs/*.json`      rebuilt by step 5

## Failure modes

- **No usable results** — report the failed search, suggest broader /
  narrower terms, do not enqueue a stub, skip step 5.
- **All sources behind paywalls** — save citations + abstracts only,
  mark `confidence: low`, still run step 5.
- **Topic too broad** — split into sub-topics, enqueue each as a
  separate pending question, run step 5 once at the end.
