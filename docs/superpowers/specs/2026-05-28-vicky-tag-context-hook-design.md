---
title: Vicky live tag-context hook
date: 2026-05-28
status: design
---

# Vicky live tag-context hook

## Problem

Vicky's knowledge lives in the vault, but Claude answers from whatever was
loaded earlier in the session. As conclusions change, the in-context copy goes
stale. We want answers to always reflect the **current** vault state for any
topic the user is actually asking about.

## Goal

On every user prompt, if a word in the prompt matches a tag that exists on a
**conclusion** in the vault, inject the current conclusion notes carrying that
tag into context — fresh from disk, every prompt. Append a hint to run deeper
research when the surfaced notes are not enough.

Non-goals: no external fetching, no skill-file rewriting, no Obsidian/Dataview
dependency, no intent/LLM matching. Pure deterministic, whole-word match.

## Approach

A single `UserPromptSubmit` hook, shipped as a new `vicky.js` subcommand. It
reads the vault directly from disk on every prompt (that **is** the freshness
mechanism — no cache in v1), matches prompt words against conclusion tags, and
prints a capped context block to stdout, which Claude Code injects as context.

Alternatives considered and rejected:
- **Regenerate a skill `description:` at SessionStart** — only session-fresh,
  relies on model judgment, no deterministic prompt-word match.
- **Shell to Obsidian/Dataview for tags** — requires Obsidian running every
  prompt; unacceptable for a per-prompt hook.

## Components

### 1. Scanner module — `src/js/hooks/tag-context.js`

- `collect_tags()` — walk **`vicky/conclusions/` only**, read each `.md`, parse
  the `tags` frontmatter list via the existing `parse_fm_list` (vault.js).
  Skip dotfiles/dot-dirs. Returns `Map<tag, Array<{title, path, snippet}>>`.
  - `title` from frontmatter `title:` (fallback to filename stem).
  - `path` as a vault-relative path / wikilink target.
  - `snippet` = first non-empty body line after frontmatter, trimmed to ~150
    chars.
- `match_prompt(prompt, tagMap)` — for each tag with `length >= 3`, test a
  whole-word, case-insensitive match against the prompt. Regex-escape the tag
  before building the `\b...\b` pattern. Returns matched tags in vault order.
- `render(matches)` — build the injected block. Per matched tag list its
  notes (title + wikilink/path + snippet). Dedupe notes that appear under
  multiple matched tags (a note shows once, under the first tag). Caps:
  - **max 5 tags**
  - **max 3 notes per tag**
  - snippet ~150 chars
  - Footer hint: a single line pointing to `/vicky:research "<topic>"` for
    deeper/fresh external data when the surfaced notes are not enough.

Caps are module-level constants (`MAX_TAGS = 5`, `MAX_NOTES = 3`,
`SNIPPET_LEN = 150`) so they are trivial to tune.

### 2. New `main.js` mode — `tag-context`

- Read hook payload JSON from **stdin**, extract `.prompt`.
- Run `collect_tags()` -> `match_prompt()` -> `render()`.
- Print the rendered block to **stdout** (Claude Code adds stdout to context on
  exit 0).
- **Always `exit 0`.** A scanner error must never block the user's prompt —
  on any failure, emit nothing and exit 0.
- Update the dispatch help banner / `unknown mode` list to include
  `tag-context`.

### 3. Hook registration — `hooks/hooks.json`

Add a `UserPromptSubmit` entry alongside the existing `SessionStart`:

```json
"UserPromptSubmit": [
  {
    "hooks": [
      { "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/vicky.js\" tag-context",
        "timeout": 10 }
    ]
  }
]
```

### 4. Build

`npm run build` regenerates `dist/vicky.js` (the bundle the hook invokes). The
new module must be reachable from `main.js` so the bundler includes it.

### 5. Tests — `src/tests/`

Unit tests, no live vault required (build fixtures in a temp dir or pass
in-memory tag maps):
- matcher: whole-word boundary (no substring hits), case-insensitivity,
  `length >= 3` skip, regex-special characters in a tag are escaped.
- renderer: 5-tag cap, 3-note cap, cross-tag dedupe, snippet truncation,
  footer hint present when there is at least one match.
- mode behaviour: empty/no `conclusions/` -> empty output, exit 0; no match ->
  empty output (no noise).

## Data flow

```
prompt
  -> UserPromptSubmit hook
  -> node dist/vicky.js tag-context   (reads prompt from stdin)
  -> collect_tags()    walk vicky/conclusions/, parse `tags`
  -> match_prompt()    whole-word, case-insensitive, len>=3
  -> render()          cap 5 tags / 3 notes, dedupe, + research hint
  -> stdout
  -> injected as additional context
  -> Claude answers from fresh conclusion notes
```

## Edge cases

| Case | Behaviour |
|------|-----------|
| No `vicky/conclusions/` dir | emit nothing, exit 0 |
| Conclusions present, no tag match | emit nothing (no noise) |
| Tag shorter than 3 chars | skipped |
| Tag contains regex-special chars | escaped before matching |
| Same note under multiple matched tags | shown once, under first tag |
| Scanner throws | swallow, emit nothing, exit 0 |
| Large vault (walk cost per prompt) | acceptable in v1; mtime-keyed cache is a deferred follow-up if it gets slow |

## Open follow-ups (not in v1)

- mtime-keyed tag-index cache if per-prompt walk becomes slow.
- Optionally also scan `sources/` (deferred — conclusions only for now).
