---
description: Docs → KB sync. Walks the repository for markdown / text documentation outside `vicky/`, finds files that changed since the last index pass, and mirrors them into `vicky/sources/`. Skips code, binaries, generated artefacts, and the vault itself. Use /vicky:index after editing READMEs, ADRs, or any project docs so Vicky stays current.
---

# Vicky Index

Sync project documentation into the KB. One pass = enumerate `.md` / `.mdx` / `.rst` / `.txt` outside `vicky/`, diff against the last index, copy changes into `vicky/sources/`, relink.

Invoke: `/vicky:index`

Optional: `/vicky:index <path>` to scope to a subtree (e.g. `/vicky:index docs/`).

## What we index

Documentation only — anything that's already meant for humans:

| Match | Examples |
|-------|----------|
| `*.md`, `*.mdx` | `README.md`, `CHANGELOG.md`, `docs/**/*.md`, ADRs, design notes |
| `*.rst` | Sphinx docs, Python project docs |
| `*.txt` | `LICENSE`, `NOTICE`, plain-text notes (only when small + text) |

## What we never index

- `vicky/**` — the vault itself
- `dist/`, `build/`, `target/`, `out/`, `node_modules/`, `.git/`, `.next/`, `.cache/`
- Any directory listed in `.gitignore`
- Source code: `.js`, `.ts`, `.rs`, `.py`, `.go`, `.c`, `.cpp`, `.h`, `.hpp`, `.java`, `.cs`, `.rb`, etc. (use `/vicky:experiment` for code optimisation, not indexing)
- Generated docs (`*.generated.md`, files under `dist/`)
- Files larger than 256 KB

## State

`vicky/index.json`:

```json
{
  "version": 1,
  "last_run": "2026-05-14T12:00:00Z",
  "last_commit": "<sha at last successful pass>",
  "files": {
    "README.md":                  { "mtime": 1715692800000, "size": 4321, "sha": "<blob sha>" },
    "docs/architecture.md":       { "mtime": 1715692800000, "size": 9012, "sha": "<blob sha>" },
    "skills/setup/SKILL.md":      { "mtime": 1715692800000, "size": 3200, "sha": "<blob sha>" }
  }
}
```

A file is "changed" when its sha / mtime / size differs from the recorded entry. Prefer git blob sha when in a git repo; fall back to mtime + size otherwise.

## Pass outline

1. **Locate root** — `git rev-parse --show-toplevel`; fall back to CWD if not a git repo.
2. **Load previous state** — read `vicky/index.json`; treat as empty on first run.
3. **Enumerate candidates** — `git ls-files` (respects `.gitignore`), filter to the doc extensions above, exclude the never-index list. Optional scope arg restricts to a subtree.
4. **Filter to changed** — compare sha/mtime/size against state. Collect (added, modified, deleted).
5. **Mirror per file** — for each added/modified entry, write `vicky/sources/docs/<slug>.md`:

   ```markdown
   ---
   title: <derived from filename or first H1>
   path: docs/architecture.md
   type: source
   subtype: docs
   date: <today>
   sha: <blob sha>
   tags: [docs, <top-level-dir>]
   ---

   <full original content, verbatim>
   ```

   Slug = path with separators replaced (`docs/architecture.md` → `docs-architecture-md`). Keep the original content as-is so Dataview, wikilinks, and graphify can index it.

   For deleted files, remove the matching source note.

6. **Persist state** — atomic write of new `vicky/index.json` (write `.tmp`, rename). Record `last_commit = git rev-parse HEAD`.
7. **Relink** — call the `relink` MCP tool so the new doc sources join the graph.
8. **Report** — N added, M modified, K deleted; hint to call `/vicky:learn` if the relink produced new pending questions.

## When to call

| Trigger | Why |
|---------|-----|
| User edited a README / ADR / design doc | Mirror the change so future queries see the new wording |
| Pulled a branch with doc changes | Sync after `git pull` |
| User says "vicky doesn't know about \<doc topic\>" | Likely the doc exists but is not yet in the KB |
| Periodic — once per session, or post-`git pull` | Keep KB aligned |

Don't call index for `vicky/` edits — that's the vault itself, indexed implicitly.

## Interactions with other skills

- `/vicky:index` writes **doc sources** (`vicky/sources/docs/`)
- `/vicky:research` writes **web sources** (`vicky/sources/web/`)
- `/vicky:learn` consumes both via the pending queue + relink
- `/vicky:experiment` is unrelated — it operates on code, not docs

## State touched

- `vicky/index.json`            updated each pass
- `vicky/sources/docs/*.md`     created / updated / deleted
- `vicky/graphs/*.json`         rebuilt via relink

Never touches `vicky/conclusions/` (derived) or `vicky/pending/` (handled by `learn` / `research`).

## Idempotency

Re-running `/vicky:index` immediately after a successful pass produces zero filesystem changes. The state file is the contract.

## Failure modes

- **Not a git repo** — fall back to mtime/size diffing; warn and continue.
- **`vicky/index.json` corrupt** — back up to `vicky/index.json.bak`, treat as first run.
- **File >256 KB** — skip mirroring; only record sha/mtime/size so future passes still detect changes.
- **Encoding error** — skip the file, record in the report, do not fail the pass.
