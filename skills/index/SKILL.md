---
description: Codebase → KB sync. Walks the repository, finds files that changed since the last index pass, extracts concepts / public APIs / structural changes, and reflects them into .vicky/sources/. Skips unchanged files. Use /vicky:index after a refactor, when the user says "vicky doesn't know about X", or on a schedule to keep the KB aligned with the code.
---

# Vicky Index

Keep the KB aligned with the live codebase. One pass = scan → diff against last index → extract from changed files → write/update sources → relink.

Invoke: `/vicky:index`

Optional: `/vicky:index <path>` to scope to a subtree (e.g. `/vicky:index src/`).

## What changes between runs

State stored at `.vicky/index.json`:

```json
{
  "version": 1,
  "last_run": "2026-05-14T12:00:00Z",
  "last_commit": "<sha at last successful pass>",
  "files": {
    "src/dashboard.js": { "mtime": 1715692800000, "size": 4321, "sha": "<blob sha>" },
    "...": {}
  }
}
```

A file is "changed" when any of these differ from the recorded entry:
- `git ls-files -m` flags it (preferred when in a git repo)
- mtime + size mismatch (fallback for non-git or untracked files)

## Pass outline

1. **Locate root**
   - Run `git rev-parse --show-toplevel` to find the project root.
   - If not in a git repo, fall back to the current working directory.

2. **Load previous state**
   - Read `.vicky/index.json`. If missing, treat every tracked file as new.

3. **Enumerate candidates**
   - `git ls-files` for tracked files (respects `.gitignore` automatically).
   - Optional scope arg restricts to a subtree.
   - Skip: binary files, generated artefacts (`dist/`, `node_modules/`, `target/`, `build/`, `.vicky/`), files larger than 256 KB.

4. **Filter to changed**
   - Compare each candidate's current sha/mtime/size against `index.json`.
   - Collect (added, modified, deleted) sets.

5. **Extract per file**
   For each added/modified file, run the appropriate extractor:

   | Extension | What to extract |
   |-----------|----------------|
   | `.md`, `.mdx` | Headings (H1–H3), frontmatter, first paragraph as summary. |
   | `.js`, `.ts`, `.jsx`, `.tsx` | Exported functions/classes, top-level JSDoc, `// TODO:` / `// FIXME:` markers. |
   | `.rs` | `pub fn` / `pub struct` / `pub enum` signatures, doc comments (`///`). |
   | `.py` | `def` / `class` signatures (top-level + public), module docstring. |
   | `.go` | Exported declarations (capitalised), package doc, function doc comments. |
   | `.c`, `.h`, `.cpp`, `.hpp` | Public function signatures, top-of-file comment, struct/enum definitions. |
   | `.toml`, `.json`, `.yaml`, `.yml` | Top-level keys, version fields, dependency list. |
   | other text | First 50 lines as raw context, only if the file is small. |

   Output per file: `{ path, summary, symbols: [...], todos: [...], links: [...] }`.

6. **Update KB**
   For each extracted entry, mirror into `.vicky/sources/code/<slug>.md` (slug derived from path, e.g. `src/dashboard.js` → `code/src-dashboard-js.md`):

   ```markdown
   ---
   title: <slug>
   path: src/dashboard.js
   type: source
   subtype: code
   date: <today>
   sha: <blob sha>
   tags: [code, <language>, <top-level-dir>]
   ---

   ## Summary
   <one-paragraph summary from doc/frontmatter/first lines>

   ## Symbols
   - `export function build_dashboard()` — ...
   - `export function run_dql(sql)` — ...

   ## TODOs
   - dashboard.js:42 — refactor cell formatter

   ## Links
   - [[other-file]] (if a wikilink-equivalent reference is detected)
   ```

   For deleted files, remove the matching source note.

7. **Persist state**
   - Write the new `.vicky/index.json` atomically (write to `.tmp`, rename).
   - Record `last_commit = git rev-parse HEAD`.

8. **Relink**
   - Call the `relink` MCP tool so the new code sources participate in the graph.

9. **Report**
   - Summarise: N added, M modified, K deleted, total time, hint to call `/vicky:learn` if new follow-up questions were generated.

## When to call

| Trigger | Why |
|---------|-----|
| User says "vicky doesn't know about X" | KB stale on that area — index pulls it in |
| After a big refactor / rename | Symbols moved, sources need re-sync |
| New module / package added | Picks up the new code with one pass |
| Periodic — once per session, or on git pull | Keep KB aligned |

Don't call index for **a single file edit** — too coarse. Use `/vicky:remember` for ad-hoc finds.

## Interactions with other skills

- `/vicky:index` writes **code sources**. `/vicky:research` writes **web sources**. They share the `.vicky/sources/` tree but use distinct subfolders (`code/`, `web/`).
- After an index pass, run `/vicky:learn` to drain any follow-up questions the extractors enqueued (TODOs become pending questions).
- `dashboard` / `dql` see code sources just like any other note — they show up in hubs, orphans, tag cloud.

## State touched

- `.vicky/index.json`            updated each pass
- `.vicky/sources/code/*.md`     created/updated/deleted to mirror the codebase
- `.vicky/pending/*.md`          may grow if TODOs/FIXMEs become follow-up questions
- `.vicky/graphs/*.json`         rebuilt via relink

Never touches `.vicky/conclusions/` directly — conclusions are derived knowledge, not code mirrors.

## Failure modes

- **Not a git repo** — fallback to mtime/size; warn and continue.
- **Extractor throws** on a malformed file — skip the file, record in the report, do not fail the whole pass.
- **`.vicky/index.json` corrupt** — back it up to `.vicky/index.json.bak`, treat as first run, rebuild.
- **Large file (>256 KB)** — skip extraction, only record sha/mtime/size in index so future passes still detect changes.

## Idempotency

Re-running `/vicky:index` immediately after a successful pass should produce zero changes. The state file is the contract.
