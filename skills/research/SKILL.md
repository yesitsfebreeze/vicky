---
description: Topic-focused web research. Enqueues a pending note for the topic, runs web search, and stores findings on the pending stub so /vicky:learn can promote them into a source + derived conclusion. Use /vicky:research "<topic>" when the KB has a gap on a specific subject. The pipeline (pending → source → conclusion → relink) is enforced by the MCP tools, not by procedural prose here.
---

# Vicky Research

Web-search a topic, drop the findings into the pending queue, let
`/vicky:learn` promote them into the KB.

Invoke: `/vicky:research "<topic>"`

Example: `/vicky:research "GPU-driven indirect draw stream compaction"`

## Contract

1. **Gap check** — call `research-gap "<topic>"`. If the KB already
   answers it, surface that and stop (unless the user asked for a refresh).
2. **Enqueue pending** — call `enqueue question="<topic>" priority=med
   sources=[<any KB sources that mention it>]`. This writes
   `.vicky/pending/<slug>.md` with `tags: [research, pending]` and a
   `sources:` frontmatter block linking to upstream notes.
3. **Web search** — call `web-search "<topic>"`. For each high-signal
   result, append a `## Sources` entry to the pending note: title, URL,
   author, date, and the key passages quoted verbatim. Reject paywalls,
   off-topic, and link-farm pages. Dedupe by canonical URL.
4. **Extract follow-ups** — for each unresolved sub-question the
   sources surface, call `enqueue question="<follow-up>"
   requested_by=research sources=[<topic-slug>]`. Tag jargon →
   "what is X?" follow-ups, conflicting claims → "reconcile X vs Y".
5. **Hand off** — call `/vicky:learn`. The tool promotes the pending
   note into `.vicky/sources/<slug>.md`, derives
   `.vicky/conclusions/<slug>.md` with `sources: [[<slug>]]`, and runs
   relink. Edges are guaranteed by the code.

## When to call

- User: `research <topic>`
- A `research-gap` came back as a gap and the user wants fresh sources
- Topic in `WORKFLOW.md → priority_tags` is under-sourced

Do not call research for questions the KB already answers (use `query`
or `research-gap`). Do not call it for bulk drain (use `/vicky:learn`).

## Quality gates

- `min_sources_per_conclusion` (WORKFLOW.md, default 2) — if fewer
  high-signal sources survive scoring, mark the pending stub
  `confidence: low` in frontmatter and ask the user to retry / abort.
- Reject sources older than 3 years for fast-moving fields unless the
  topic is foundational.

## State touched

- `.vicky/pending/*.md`   topic stub + follow-up questions
- web fetches              cached per the web-search tool's own state

`/vicky:learn` handles the downstream transitions (sources, conclusions,
relink) so this skill never writes outside `.vicky/pending/`.

## Failure modes

- **No usable results** — report the failed search, suggest broader /
  narrower terms, do not enqueue a stub.
- **All sources behind paywalls** — save citations + abstracts only,
  mark `confidence: low`.
- **Topic too broad** — split into sub-topics, enqueue each as a
  separate pending question, report.
