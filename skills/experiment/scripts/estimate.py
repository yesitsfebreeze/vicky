#!/usr/bin/env python3
"""
Parse experiment.md and estimate time for each task.

Estimates are based on:
  - Baseline times (build, test, benchmark)
  - Component scope (files changed, new tests)
  - Historical learned factors from autoresearch.json
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Baseline times (in seconds)
BASELINE_BUILD = 30
PER_FILE_BUILD = 10
BASELINE_TEST = 5
PER_TEST_TIME = 2
BASELINE_BENCHMARK = 30  # 5 zoom levels × 5 runs + overhead
BUFFER_FACTOR = 1.2

def parse_experiment_md(path: Path) -> List[Dict]:
    """Parse experiment.md and extract task metadata."""
    with open(path) as f:
        content = f.read()

    tasks = []
    # Split by Task headers
    task_blocks = re.split(r'^## Task \d+:', content, flags=re.MULTILINE)[1:]

    for block in task_blocks:
        lines = block.strip().split('\n')
        task = {
            'name': lines[0].strip(),
            'component': None,
            'goal': None,
            'changes': [],
            'baseline': {},
            'target': None,
            'criteria': []
        }

        current_section = None
        for line in lines[1:]:
            if line.startswith('**Component:**'):
                task['component'] = line.split(':**')[1].strip()
            elif line.startswith('**Goal:**'):
                task['goal'] = line.split(':**')[1].strip()
            elif line.startswith('**Changes:**'):
                current_section = 'changes'
            elif line.startswith('**Baseline'):
                current_section = 'baseline'
            elif line.startswith('**Target:**'):
                current_section = 'target'
            elif line.startswith('**Success'):
                current_section = 'criteria'
            elif current_section == 'changes' and line.strip().startswith('- '):
                task['changes'].append(line.strip()[2:])
            elif current_section == 'criteria' and line.strip().startswith('- '):
                task['criteria'].append(line.strip()[2:])

        tasks.append(task)

    return tasks

def estimate_time(task: Dict, learned_factor: float = 1.0) -> int:
    """Estimate execution time in seconds for a task."""
    num_changes = len(task.get('changes', []))
    num_criteria = len(task.get('criteria', []))

    # Heuristic: estimate files changed from changes list
    # (conservative: ~1 file per 2 changes)
    estimated_files = max(1, num_changes // 2)
    # Estimate new tests from criteria list
    estimated_tests = max(0, len([c for c in task.get('criteria', [])
                                   if 'test' in c.lower()]))

    build_time = BASELINE_BUILD + (estimated_files * PER_FILE_BUILD)
    test_time = BASELINE_TEST + (estimated_tests * PER_TEST_TIME)
    benchmark_time = BASELINE_BENCHMARK

    total = (build_time + test_time + benchmark_time) * BUFFER_FACTOR
    return int(total * learned_factor)

def load_state(state_path: Path) -> Dict:
    """Load autoresearch.json state."""
    if state_path.exists():
        with open(state_path) as f:
            return json.load(f)
    return {
        'queue': [],
        'baseline_perf': {},
        'cycles': []
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: estimate.py <experiment.md> [autoresearch.json]")
        sys.exit(1)

    exp_path = Path(sys.argv[1])
    state_path = Path(sys.argv[2]) if len(sys.argv) > 2 else exp_path.parent / '.claude' / 'autoresearch.json'

    if not exp_path.exists():
        print(f"Error: {exp_path} not found")
        sys.exit(1)

    tasks = parse_experiment_md(exp_path)
    state = load_state(state_path)

    # Build learned factor map from queue
    learned_factors = {}
    for task_entry in state.get('queue', []):
        if 'learned_factor' in task_entry:
            learned_factors[task_entry['task_id']] = task_entry['learned_factor']

    print("Task Estimates")
    print("-" * 60)

    total_estimate = 0
    for i, task in enumerate(tasks, 1):
        learned_factor = learned_factors.get(i, 1.0)
        estimate_sec = estimate_time(task, learned_factor)
        total_estimate += estimate_sec

        print(f"Task {i}: {task['name']}")
        print(f"  Component: {task['component']}")
        print(f"  Changes: {len(task['changes'])} items")
        print(f"  Criteria: {len(task['criteria'])} items")
        print(f"  Learned factor: {learned_factor:.2f}")
        print(f"  Estimate: {estimate_sec}s ({estimate_sec // 60}m {estimate_sec % 60}s)")
        print()

    print("-" * 60)
    print(f"Total estimate: {total_estimate}s ({total_estimate // 60}m {total_estimate % 60}s)")

    # Capacity scheduling
    DEFAULT_CAPACITY = 30 * 60  # 30 minutes
    if total_estimate <= DEFAULT_CAPACITY:
        print(f"✓ Fits in default capacity ({DEFAULT_CAPACITY // 60}m)")
    else:
        cycles = (total_estimate + DEFAULT_CAPACITY - 1) // DEFAULT_CAPACITY
        print(f"⚠ Requires {cycles} cycles @ {DEFAULT_CAPACITY // 60}m each")

if __name__ == '__main__':
    main()
