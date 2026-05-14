---
description: Topic-focused deep-dive research. Takes a topic, web-searches it, reads the best sources, saves them to .vicky/sources/ with frontmatter and citations, extracts follow-up questions, and enqueues them to .vicky/pending/ for later processing by /vicky:learn. Use /vicky:research "<topic>" when the KB has a gap on a specific subject and you want fresh sources rather than synthesis from existing notes.
---

# Vicky Research

Focused web research for a single topic. One pass: search → read → save → extract follow-ups → enqueue.

Invoke: `/vicky:research "<topic>"`

Example: `/vicky:research "GPU-driven indirect draw stream compaction in Vulkan"`

## What the skill does

1. **Check WORKFLOW.md** — pick up `active_focus`, `priority_tags`, `min_sources_per_conclusion`, `research_depth`.
2. **Check existing KB** — run `research-gap "<topic>"` first. If the KB already answers it, surface that and stop (unless the user asked for a refresh).
3. **Search the web** — call the `web-search` MCP tool. `research_depth: deep` requests more results + cross-references. Default depth pulls ~5–10 results.
4. **Read + score** — for each result:
   - Fetch the content
   - Score by relevance to the topic + alignment with `active_focus`
   - Reject low-signal pages (paywalls, link farms, off-topic)
5. **Save sources** — for each kept result, call `remember title="<page title>" content="<extracted markdown>"` with:
   - `tags: [source, <topic-slug>, ...active_focus matches]` (always `source`, never `research` — the `research` tag is reserved for items still pending)
   - URL + author + date in body
   - Quoted key passages preserved verbatim
   - Pass any upstream notes that prompted this lookup via the `sources` arg so the new source carries `sources: [[...]]` frontmatter + a `## Sources` body block. The reverse edge lands automatically via `relink`.
6. **Extract follow-up questions** — scan the read content for:
   - Terms the source assumes the reader knows (jargon → "what is X?" follow-ups)
   - Open problems / "future work" sections
   - Conflicting claims across sources (→ "reconcile X vs Y" follow-ups)
   For each follow-up, call `enqueue "<question>"` with `requested_by: research`, `priority: med` by default (or `high` if the question blocks the original topic).
7. **Write topic conclusion stub** — call `conclude title="<topic>"` (NOT `remember` — `remember` only writes to `.vicky/sources/`) with:
   - One-paragraph summary in `content`
   - `sources: [<each saved source title>]` — the tool writes them as `[[wikilinks]]` in both frontmatter and a `## Sources` body block, so the conclusion is graph-connected to every source it derives from
   - `## Open Questions` section listing the enqueued follow-ups (in `content`)
   - Extra `tags` are merged with `conclusion`; the `research` / `pending` tags are stripped automatically
8. **Relink** — call `relink` so the new sources + conclusion appear in graphs and `related:` frontmatter.
9. **Report** — summarise: N sources saved, M follow-ups enqueued, conclusion stub path, dashboard hint.

## When to call

| Trigger | Why |
|---------|-----|
| User: "research \<topic\>" | Direct call |
| User question that `research-gap` flagged as a gap | Promote a queued question into a focused pass instead of waiting for `/vicky:learn` |
| Topic in `WORKFLOW.md → priority_tags` is under-sourced | Proactive deep-dive |

Do **not** call research for:
- Questions the KB already answers (use `query` or `research-gap`)
- Bulk queue processing (use `/vicky:learn`)
- Code-optimisation experiments (use `/vicky:experiment`)

## Quality gates

- `min_sources_per_conclusion` (WORKFLOW.md, default 2) — if fewer high-signal sources survive scoring, the conclusion stub is marked `confidence: low` in frontmatter and the user is asked whether to keep, retry with broader search terms, or abort.
- Reject sources older than 3 years for fast-moving fields (graphics, ML) unless the topic is foundational.
- Deduplicate by canonical URL before saving.

## State touched

- `.vicky/sources/<topic-slug>/*.md`  new source notes
- `.vicky/conclusions/<slug>.md`      topic conclusion stub
- `.vicky/pending/*.md`               follow-up questions enqueued
- `.vicky/graphs/*.json`              rebuilt via relink

## Failure modes

- **No usable results** — report the failed search, suggest broader/narrower terms, do not write a stub.
- **All sources behind paywalls** — save citations + abstracts only, mark `confidence: low`.
- **Topic too broad** — split into sub-topics, enqueue each as a separate pending question, report.

## Pairing with /vicky:learn

`/vicky:research` produces fresh sources and a stack of follow-up questions. `/vicky:learn` drains those follow-ups in the next pass. Typical cycle:

```
user: /vicky:research "logarithmic z-slicing"
  → 6 sources saved, 8 follow-ups enqueued
later:
user: /vicky:learn
  → 8 follow-ups drained into conclusion stubs, graphs rebuilt
```
