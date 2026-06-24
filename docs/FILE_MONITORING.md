# File Monitoring

Vicky's file monitor watches key knowledge base files for changes and automatically triggers dependent operations. This eliminates the need for periodic polling — reactions happen in real-time as your KB evolves.

## What It Watches

The monitor tracks these files and directories:

| Target | Change | Reaction |
|--------|--------|----------|
| `.graphify/graph.json` | changed/created | Auto-relink sources + conclusions |
| `.graphify/.graphify_ast.json` | changed | Re-analyze file importance + trigger learn |
| `.graphify/manifest.json` | changed | Auto-relink |
| `pending/` | files added | Auto-trigger learn (drain queue) |
| `sources/` | files added/changed | Auto-relink + update KB graph |

## How It Works

1. **Initialization**: On server start, monitor captures initial file mtimes and directory file counts.
2. **Polling**: Every 10 seconds (configurable), check for changes.
3. **Reaction**: On change, schedule the dependent operation with 500ms debounce (batches rapid changes).
4. **Non-blocking**: Reactions run asynchronously via the job queue — monitor doesn't block the MCP server.

## Configuration

Add to `vicky.config.json`:

```json
{
  "fileMonitor": {
    "enabled": true,
    "intervalMs": 10000
  }
}
```

- `enabled` (default: `true`): Turn file monitoring on/off.
- `intervalMs` (default: `10000`): Check interval in milliseconds. Smaller = faster reaction, higher CPU. Typical: 5000-15000ms.

## Disable for Specific Operations

If you want to avoid auto-reactions during bulk imports or large refactors:

```json
{
  "fileMonitor": {
    "enabled": false
  }
}
```

Then manually trigger `/vicky:learn` and `/vicky:relink` when ready.

## Example Workflow

1. Run `graphify extract` → updates `.graphify_ast.json` → monitor triggers `/vicky:learn`
2. Answer research gaps elsewhere → files appear in `pending/` → monitor triggers `/vicky:learn`
3. Conclusions get synthesized, source links update → `sources/` changes → monitor triggers `relink`
4. Graph rebuilds → `.graphify/graph.json` updates → monitor triggers `relink` again to refresh `related:` links

No manual `/vicky:learn` or `/vicky:relink` calls needed — the monitor orchestrates the chain.

## Monitoring Status

Check the job queue to see pending monitor-triggered actions:

```
/vicky:job-status
```

Look for jobs prefixed `auto-relink` or `auto-learn` to confirm monitoring is active.

## Troubleshooting

**Monitor isn't reacting**
- Check `vicky.config.json` — `fileMonitor.enabled` must be `true`.
- Check if the MCP server is running (monitor runs in the server process).
- Increase `intervalMs` if you have many files (polling can be slow on large vaults).

**Monitor reacting too aggressively**
- Increase `intervalMs` (e.g., 30000ms for slower polling).
- Or disable monitoring during bulk operations.

**File changes aren't detected**
- Ensure the files are in `vicky/` (the vault root configured in `vicky.env` → `VICKY_ROOT`).
- Check file permissions — monitor needs read access.
