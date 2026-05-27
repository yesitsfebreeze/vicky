---
name: crystalize
description: Condense KB - absorb redundant sources into a mature conclusion. Source files move to vicky/sources/.absorbed/ (hidden dotfolder, excluded from queries/dashboard/graph), conclusion records them under derived_from: frontmatter. Crystallization keeps the KB small while preserving provenance. Use /vicky:crystalize when one conclusion is the canonical takeaway and underlying sources no longer need to surface. Always dry-run first.
---

# Vicky Crystalize

Condense the KB. Goal: small, dense knowledge base; one canonical answer per topic; provenance kept on disk but hidden from active surfaces.

Invoke: `/vicky:crystalize`

## Contract

For a target conclusion + list of source slugs, the `crystalize` MCP tool:

1. Moves each `vicky/sources/<slug>.md` to `vicky/sources/.absorbed/<slug>.md` (Obsidian dotfolder, excluded from graph and dashboard).
2. Removes absorbed slugs from the conclusion `sources:` frontmatter.
3. Appends absorbed slugs to the conclusion `derived_from:` frontmatter.
4. Leaves conclusion body untouched (manual cleanup if you want to strip body wikilinks).

Run `/vicky:learn` after to rebuild the graph.

## When to crystalize

- Conclusion has matured; underlying sources are redundant detail.
- Multiple sources collapsed into one synthesis with no remaining unique signal in the source bodies.
- Dashboard "Sources awaiting synthesis" surfaces items that are actually already absorbed in some conclusion.

Do NOT crystalize when:

- Sources still differ in detail you might re-derive from later.
- Conclusion may split soon (absorb post-split, not before).
- No written conclusion yet - `conclude` first.

## Workflow

1. **Dry run** - `crystalize conclusion=<slug> absorb=[...] dry_run=true` shows proposed moves and new frontmatter.
2. **Apply** - drop `dry_run`.
3. **Relink** - `/vicky:learn`.

## Restoring

Sources are NOT deleted. To restore:

1. Move file from `vicky/sources/.absorbed/<slug>.md` back to `vicky/sources/<slug>.md`.
2. Edit conclusion frontmatter: remove slug from `derived_from:`, add back to `sources:`.
3. `/vicky:learn` to relink.

## Splitting a conclusion

Not yet automated. Manual today:

1. `conclude` a second conclusion from the split topic.
2. Move relevant `derived_from:` entries to the new conclusion.
3. Edit original conclusion body to remove the split content.

## Known limitations

- Conclusion body `## Sources` markdown block is NOT updated - only frontmatter. Edit body by hand if you want stale wikilinks removed.
- `[[slug]]` wikilinks in conclusion body to absorbed sources will show as "unresolved" in Obsidian (dotfolder is not indexed by Obsidian). Provenance lives in `derived_from:` frontmatter for tooling.
- No clustering / auto-suggest yet. Caller picks the absorb set.

## State touched

- `vicky/sources/<slug>.md` -> `vicky/sources/.absorbed/<slug>.md`
- `vicky/conclusions/.../<conc>.md` frontmatter: `sources:` shrunk, `derived_from:` grown
- `vicky/graphs/*.json` stale until `/vicky:learn` runs
