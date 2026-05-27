---
type: workflow
active_focus: []
priority_tags: []
research_depth: default
auto_enqueue: true
min_sources_per_conclusion: 2
default_workflow: default
---

# Vicky Workflow

Entry point for configuring vicky. Edit this file to direct attention, change rules,
or switch workflows. Agents read this on every invocation.

## Focus

> What vicky should pay attention to right now.
> List topics, tags, or folders. Empty = no filter.

- (add focus areas here)

## Active Rules

- Always link sources to conclusions via `[[wikilinks]]`.
- Minimum `min_sources_per_conclusion` sources before saving a conclusion.
- Never auto-enqueue duplicates (pending/ already has it).
- Skip domains: (list domains to exclude)

## Workflows

### default

Standard query → gap → enqueue → research → learn loop.

1. `query` against KB
2. If gap detected → `enqueue` with context (or call `/vicky:research` directly)
3. `/vicky:research` fetches sources for the topic and calls `learn` to absorb them
4. `/vicky:learn` alone drains anything still pending without new fetches

### deep-dive

For perf, architecture, hard problems. More sources, deeper synthesis.

1. `query` + expand `related` graph one hop
2. `web-research` minimum 5 sources
3. Synthesize → save conclusion with `depth: deep` frontmatter
4. `relink` to cross-reference siblings

### triage

Only process pending where `priority: high`. Skip all other gaps.

1. List pending sorted by priority
2. Process only `high`
3. Defer rest

## Routing

Map question patterns → workflow. First match wins.

| pattern             | workflow   |
| ------------------- | ---------- |
| `/perf|gpu|render/` | deep-dive  |
| `/quick|lookup/`    | default    |
| `/urgent|blocker/`  | triage     |
| (default)           | default    |

## Notes for agents

- Read frontmatter first, then `Focus`, then `Active Rules`.
- If `active_focus` non-empty, prefer matching nodes for `query` results.
- Honor `auto_enqueue: false` by returning gap without writing pending.

### crystalize

Condense KB. Absorb redundant source(s) into a mature conclusion. Source files move to `sources/.absorbed/` (hidden dotfolder), conclusion records them under `derived_from:` frontmatter.

1. Identify mature conclusion + redundant sources
2. `crystalize conclusion=<slug> absorb=[<source-slugs>] dry_run=true` — preview
3. `crystalize` without `dry_run` — moves files, updates `derived_from:`
4. `/vicky:learn` — rebuild graph

Use when one conclusion is the canonical takeaway and source notes no longer carry unique signal. Restore by moving file back from `.absorbed/` and editing frontmatter. See `/vicky:crystalize` skill for full contract.
