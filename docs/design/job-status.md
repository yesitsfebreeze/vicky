# Job Status for `learn` / `relink`

## 1. Current behavior

Both tools fire-and-forget an async IIFE and return immediately. From `src/js/tools/learn.js`:

```js
(async () => { /* drain pending, relink */ })();
return { content: [{ type: 'text', text: `Learning up to ${n} pending notes in background.` }] };
```

From `src/js/tools/relink.js`:

```js
(async () => { /* update_kb, relink_dir x2 */ })();
return { content: [{ type: 'text', text: 'Relinking all conclusions in background.' }] };
```

Progress is surfaced only via `notify('info', ...)` MCP notifications — not addressable, not queryable. Callers cannot tell when a follow-up `dql`/`query` will see the new state.

## 2. Option A — block-with-timeout

Sketch:

```js
const p = doWork();                       // resolves to { promoted, src, con }
const r = await Promise.race([p, sleep(timeoutMs).then(() => 'TIMEOUT')]);
return r === 'TIMEOUT'
  ? { status: 'timeout', note: 'still running; check notifications' }
  : { status: 'done', counts: r };
```

Pros: one tool, no registry, no IDs, no expiry. Done-path is fully synchronous from the caller's view.
Cons: `update_kb` (graphify + LLM) routinely exceeds 30 s on real vaults; timeout becomes the common case, leaving the original "is it done?" problem. MCP stdio has no per-tool cancel, so a timed-out job keeps running invisibly.

## 3. Option B — job_id + poll

Registry (in-memory, per-process Map; lost on server restart, acceptable since jobs are idempotent):

```js
jobs.set(id, { kind, status: 'running', started, progress: {}, counts: null, error: null });
```

New tool `job-status`:

```js
inputSchema: { job_id: z.string() }
// returns { status: 'running'|'done'|'failed', progress, counts, elapsed_ms, error? }
```

`learn`/`relink` return `{ status: 'queued', job_id, est_seconds }`. The worker updates the entry as it crosses phases (`drain`, `graph`, `relink`).

Pros: matches actual runtime shape; caller can gate the next DQL on `status === 'done'`; trivial to add `progress.phase` for UX. Cons: registry lifecycle (expiry sweep, max-entries cap), one new tool, callers must poll.

## 4. Recommendation

**Option B.** `update_kb` invokes graphify with an LLM backend — wall time scales with corpus size and routinely blows past any reasonable block-with-timeout window, so Option A degrades to Option B's "queued" path in the common case while still adding a useless timeout knob. An in-memory registry is ~30 lines and keeps the existing notify-stream as a bonus channel. Jobs are idempotent (slug-keyed `save_note`, deterministic `relink_dir`), so losing the registry on restart is harmless. The new `job-status` tool also unlocks future progress UX in the dashboard.

## 5. Open questions (Option B)

- **Persistence**: in-memory Map is enough for v1; revisit only if a dashboard wants cross-restart history.
- **Expiry**: drop `done`/`failed` entries after 1 h or when count exceeds 100, whichever first.
- **Concurrency**: reject a second `learn` while one is `running` (return existing `job_id`); `relink` likewise. Different kinds may run in parallel.
