# File Monitors for Vicky

Vicky skills can instruct Claude Code to create **file monitors** on dependent files. When a monitored file changes, Claude automatically reacts (relink, relearn, etc.) without manual intervention.

## How It Works

When you run a vicky skill (learn, research, index), it creates monitors via Claude Code:

```bash
/monitor create <file-or-dir> \
  --on <event> \
  --run "<command>"
```

### Monitor Events

| Event | Trigger | Use case |
|-------|---------|----------|
| `change` | File content changes | Detect graph updates, source edits |
| `new-file` | New file in directory | Detect pending queue growth, new sources |
| `delete` | File deleted | Detect source removal (rare) |

### Monitor Commands

| Command | When set up | Effect |
|---------|------------|--------|
| `/vicky:relink` | Graph changes | Rebuild semantic links across KB |
| `/vicky:learn` | Pending queue grows | Drain pending → sources → relink |
| (arbitrary Claude command) | Any file change | Extensible — run any command |

## Monitors Created by Each Skill

### `/vicky:learn`

Sets up monitors on dependent files:

```
/monitor create vicky/.graphify/graph.json \
  --on change --run "/vicky:relink"

/monitor create vicky/.graphify/.graphify_ast.json \
  --on change --run "/vicky:learn"

/monitor create vicky/pending/ \
  --on new-file --run "/vicky:learn"

/monitor create vicky/sources/ \
  --on change --run "/vicky:relink"
```

**Effect:** KB stays current. Graph rebuilds auto-trigger relink. Pending queue auto-triggers learn. No manual calls needed.

### `/vicky:research`

Calls `/vicky:learn` at the end, so same monitors as learn.

### `/vicky:index`

Writes doc sources, then calls relink. Consider adding:

```
/monitor create docs/ \
  --on change --run "/vicky:index"
```

This mirrors doc changes into vicky automatically.

### `/vicky:crystalize`

Calls `/vicky:learn` after condensing, so same monitors as learn.

## Managing Monitors

### List all active monitors

```
/monitor list
```

Shows file paths, events, and commands.

### Disable a monitor (without deleting)

```
/monitor pause vicky/.graphify/graph.json
```

Resume later:

```
/monitor resume vicky/.graphify/graph.json
```

### Delete a monitor permanently

```
/monitor delete vicky/.graphify/graph.json
```

Or delete all vicky monitors:

```
/monitor delete vicky/
```

(This is a glob pattern.)

## Disabling Monitors Temporarily

If you're doing bulk edits (large refactor, bulk import) and don't want monitors firing constantly:

```
/monitor pause vicky/
```

Then re-enable when done:

```
/monitor resume vicky/
```

Or delete them and let `/vicky:learn` recreate them on next run.

## Troubleshooting

**Monitors not triggering**
- Run `/monitor list` — are they active?
- Check file paths — must match exactly (absolute or relative to vault root).
- Make sure the file actually changed (small edits, encoding changes, mtime-only, might not trigger).
- Monitor is paused? Run `/monitor resume`.

**Too many auto-triggers**
- Pause monitors during bulk work (`/monitor pause vicky/`).
- Delete and recreate to reset (some tools might leave stale monitors).

**Monitor triggering wrong command**
- Delete: `/monitor delete vicky/<file>`
- Let the skill recreate it, or manually create with correct command.

## Advanced: Custom Monitors

You can create monitors beyond what skills set up. Example:

```
/monitor create vicky/conclusions/ \
  --on change --run "/vicky:dashboard"
```

This refreshes the dashboard whenever a conclusion changes.

Or monitor a source directory outside vicky:

```
/monitor create docs/ \
  --on change --run "/vicky:index docs/"
```

Auto-sync docs on change.
