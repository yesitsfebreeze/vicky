---
description: Autonomous code-optimization loop. Reads experiment.md task queue, estimates time per task, executes in git worktrees (build + test + perf benchmark), measures actual time, learns estimates, merges improvements. Capacity-queue scheduling fills 30-min cycles and repeats. Use /vicky:experiment to start the loop. Estimates self-correct over time. Works for rendering, shader, physics, LOD optimization.
---

# Experiment: Continuous Optimization Loop

Run iterative experiments with adaptive time estimation and auto-merging.

## How It Works

Capacity-queue scheduler:
1. Parse `experiment.md` task queue
2. Estimate time per task (based on scope + historical data)
3. Fill schedule: pick tasks fitting in 30-min budget
4. Execute in worktree: build + test + perf benchmark (zoom in/out)
5. Measure actual time, compare perf delta vs baseline
6. Learn: next_estimate = actual + (actual - estimate) / 2
7. Merge if improvement (Δ > 1%), update baseline
8. Refill: repeat until queue empty or timeout

Example: 30-min capacity
```
Task A (est. 8 min) ✓ fits
Task B (est. 9 min) ✓ fits
Task C (est. 7 min) ✓ fits
Task D (est. 9 min) ✗ doesn't fit → defer
[execute A, B, C] → next cycle
```

## Commands

```
/vicky:experiment              # Start the loop (picks tasks, executes, repeats)
```

## experiment.md Format

Multiple tasks, each independent optimization:

```markdown
# Experiments Queue

## Task 1: Tile Subdivision Optimization
- Component: tile_subdiv
- Changes:
  - Reduce redundant tile splits (cache reuse)
  - Optimize marker pass warp utilization
- Baseline: 2.3ms @ 1920x1080, 0.1x zoom
- Target: < 2.0ms
- Estimate: 8 min (based on scope)

## Task 2: Forward+ Light Culling
- Component: forward_plus
- Changes:
  - Increase max lights per tile (profiling showed headroom)
  - SIMD depth sort per tile
- Baseline: 1.2ms, 10.0x zoom
- Target: < 1.0ms
- Estimate: 6 min

## Task 3: Tet Mesh Compression
- Component: tet_propagation
- Changes:
  - Pack face adjacency into 16-bit indices
  - Reduce GPU heap usage
- Baseline: 512 MB peak, 1M tets
- Target: < 384 MB
- Estimate: 10 min
```

## Capacity Scheduling

Default capacity: **30 min per cycle**.

Scheduler fills schedule greedily:
```
Capacity: 30 min
Task 1 (est. 8 min) → fits, schedule. Remaining: 22 min
Task 2 (est. 6 min) → fits, schedule. Remaining: 16 min
Task 3 (est. 10 min) → fits, schedule. Remaining: 6 min
[queue empty or no task fits]
Execute scheduled tasks in sequence
```

After cycle: merge wins, update baselines, relearn estimates, refill.

## Task Lifecycle

### 1. Estimate

Parse task scope from experiment.md and consult `.claude/experiment.json` for historical data:

```python
estimate = (build_time + test_time + benchmark_time) × learned_factor
learned_factor = 1.0 initially; learned from actual / estimate over time
```

Baseline estimate:
- Build: 30s + 10s per file changed
- Test: 5s + 2s per new test
- Benchmark: 30s (5 zoom levels, 5 runs, discard first 2)
- Buffer: +20%

Example: Task 1 (2 files, 1 new test) → 50s + 7s + 30s + 19.2s ≈ 8 min

Store estimate in `.claude/experiment.json` task queue.

### 2. Execute Task in Worktree

Create worktree: `git worktree add .claude/worktrees/experiment-task-<id>`

Apply changes from task description, then:
```bash
cargo build --release
cargo test --release
phynite run --scene zoom-benchmark \
  --zoom 0.1 --zoom 1.0 --zoom 10.0 \
  --iterations 5 --warmup 2 \
  --capture-perf perf.json
```

Record actual execution time (wall-clock from start to finish).

### 3. Measure & Grade

Parse baseline and current perf.json, compute Δ:
```
Δ = (current_median - baseline_median) / baseline_median × 100%
```

Decision:
- Δ < 0 and |Δ| > 1%: **improvement** → merge, update baseline
- Δ >= 0 or |Δ| ≤ 1%: **neutral** → discard, try next task
- Δ > +2%: **regression** → discard (keep log for debugging)

### 4. Learn & Update Queue

Update task estimate:
```
new_estimate = actual_time + (actual_time - estimate) / 2
```

Store in `.claude/experiment.json`. Next cycle will use tighter or looser estimates based on learned factor.

Example:
- Estimate: 8 min (480s)
- Actual: 6 min (360s)
- Learned factor: (360 + (360 - 480) / 2) / 480 = (360 - 60) / 480 = 0.625
- Next estimate for similar tasks: 8 min × 0.625 ≈ 5 min

### 5. Merge & Cleanup

If merged: commit, update master baseline, cleanup worktree.

If discarded: cleanup worktree, log reason, move to next task in cycle.

### 6. Convergence Detection

Stop loop if:
- Last 3 cycles: Δ < 0.5% (noise floor)
- Estimate & actual converge: |estimate - actual| / actual < 10%
- User runs `stop experiment`

## State File

**`.claude/experiment.json`** — Tracks queue, baselines, learning factors:
```json
{
  "capacity_sec": 1800,
  "baseline_perf": {"tile_subdiv_ms": 2.3, "forward_plus_ms": 1.2},
  "queue": [
    {"task_id": 1, "name": "tile_subdivision", "estimate_sec": 480, "learned_factor": 1.0, "status": "pending"}
  ],
  "cycles": [
    {"cycle": 1, "scheduled_tasks": [1], "results": [{"task_id": 1, "actual_sec": 400, "perf_delta_percent": -2.1, "status": "merged"}]}
  ]
}
```


## Edge Cases

**Build fails:** Record failure, don't merge, offer to inspect logs. Keep worktree for debugging.

**Test fails:** Same as build — no merge. User can edit experiment.md and retry.

**Benchmark noisy:** If variance > tolerance, re-run (up to 2 retries), then accept median.

**Merge conflict:** Stop loop, let user resolve manually, then resume.

**No improvement:** Loop continues. If 5+ cycles with Δ < 0.1%, auto-converge and stop.

## Performance Expectations

- Small experiment (1-2 files): 2-3 min per cycle
- Medium (3-5 files): 3-5 min per cycle
- Large (6+ files, new tests): 5-10 min per cycle

After 3-4 cycles, estimates should stabilize within ±20%.

## Example Session

```
User: /vicky:experiment
Claude: Parsed experiment.md (tile-subdiv optimization).
Estimate: 2.5 min. Creating worktree...
[builds, tests, benchmarks]
Actual: 2.1 min. Perf delta: -1.8% (improvement ✓).
Merging to master. Next estimate: 2.4 min.
Scheduled next cycle in 3 min.

[ScheduleWakeup fires after 3 min]
Cycle 2: Estimate 2.4 min...
[repeats]

[After 5 cycles, convergence: last 3 Δ < 0.5%]
Converged. Final result: -7.3% perf improvement over baseline.
Experiment complete. Worktree cleaned up.
```

---

## Troubleshooting

**"experiment.md not found"** — Create `experiment.md` in repo root with the format above, or specify alternate path: `/vicky:experiment docs/experiments/phase-6.md`

**"Perf graph missing"** — Ensure `phynite run --capture-perf` writes valid JSON to `perf.json`. Check `test.log` for runtime errors.

**"Loop stuck / not scheduling"** — Check `.claude/experiment.json` for `status: "error"`. Run `/vicky:experiment status` to see current state. Use `/vicky:experiment reset` to restart.

**"Worktree cleanup failed"** — Manually remove `.claude/worktrees/experiment-*` if process was killed. Git may lock worktree; `git worktree prune` can help.
