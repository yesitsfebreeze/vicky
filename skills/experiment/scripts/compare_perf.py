#!/usr/bin/env python3
"""
Compare baseline and current perf.json outputs.

Computes Δ (delta), grades result as improvement/neutral/regression,
and outputs decision for autoresearch.
"""

import json
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional

# Thresholds
IMPROVEMENT_THRESHOLD = 0.01  # 1% improvement needed
REGRESSION_THRESHOLD = 0.02   # 2% regression triggers discard
NOISE_FLOOR = 0.005           # 0.5% considered noise

def parse_perf_json(path: Path) -> Dict:
    """Parse perf.json benchmark output."""
    with open(path) as f:
        return json.load(f)

def compute_median(values: list) -> float:
    """Compute median of values."""
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 0:
        return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2
    return sorted_vals[n // 2]

def extract_metrics(perf_data: Dict) -> Dict[str, float]:
    """Extract median latencies per zoom level from perf.json."""
    metrics = {}

    if 'zoom_levels' in perf_data:
        for zoom_entry in perf_data['zoom_levels']:
            level = zoom_entry.get('level', 'unknown')
            latencies = zoom_entry.get('latencies_ms', [])
            if latencies:
                median = compute_median(latencies)
                metrics[f'zoom_{level}'] = median

    return metrics

def compare_metrics(baseline: Dict[str, float], current: Dict[str, float]) -> Tuple[float, Dict]:
    """
    Compare baseline and current metrics.

    Returns:
      - delta_percent: average Δ across all metrics
      - per_metric: dict of {metric: delta_percent}
    """
    if not baseline or not current:
        return 0.0, {}

    deltas = {}
    for metric, baseline_val in baseline.items():
        if metric in current:
            current_val = current[metric]
            delta = (current_val - baseline_val) / baseline_val * 100
            deltas[metric] = delta

    avg_delta = sum(deltas.values()) / len(deltas) if deltas else 0
    return avg_delta, deltas

def grade_result(delta_percent: float) -> Tuple[str, str]:
    """
    Grade result as improvement/neutral/regression.

    Returns:
      - grade: "improvement" | "neutral" | "regression"
      - reason: short explanation
    """
    if delta_percent < -IMPROVEMENT_THRESHOLD * 100:
        return 'improvement', f'Δ {delta_percent:.2f}% (improvement)'
    elif delta_percent > REGRESSION_THRESHOLD * 100:
        return 'regression', f'Δ {delta_percent:.2f}% (regression)'
    else:
        if abs(delta_percent) <= NOISE_FLOOR * 100:
            return 'neutral', f'Δ {delta_percent:.2f}% (noise floor)'
        else:
            return 'neutral', f'Δ {delta_percent:.2f}% (below threshold)'

def main():
    if len(sys.argv) < 3:
        print("Usage: compare_perf.py <baseline.json> <current.json> [--json]")
        sys.exit(1)

    baseline_path = Path(sys.argv[1])
    current_path = Path(sys.argv[2])
    json_output = '--json' in sys.argv

    if not baseline_path.exists():
        print(f"Error: baseline {baseline_path} not found")
        sys.exit(1)

    if not current_path.exists():
        print(f"Error: current {current_path} not found")
        sys.exit(1)

    baseline_data = parse_perf_json(baseline_path)
    current_data = parse_perf_json(current_path)

    baseline_metrics = extract_metrics(baseline_data)
    current_metrics = extract_metrics(current_data)

    delta_percent, per_metric = compare_metrics(baseline_metrics, current_metrics)
    grade, reason = grade_result(delta_percent)

    result = {
        'delta_percent': round(delta_percent, 2),
        'grade': grade,
        'reason': reason,
        'per_metric': {k: round(v, 2) for k, v in per_metric.items()},
        'baseline_metrics': {k: round(v, 3) for k, v in baseline_metrics.items()},
        'current_metrics': {k: round(v, 3) for k, v in current_metrics.items()}
    }

    if json_output:
        print(json.dumps(result, indent=2))
    else:
        print(f"Comparison Results")
        print("-" * 60)
        print(f"Grade: {grade.upper()}")
        print(f"Δ (average): {delta_percent:.2f}%")
        print()
        print("Per-metric deltas:")
        for metric, delta in per_metric.items():
            baseline_val = baseline_metrics.get(metric, 'N/A')
            current_val = current_metrics.get(metric, 'N/A')
            direction = '↓' if delta < 0 else '↑'
            print(f"  {metric}: {direction} {abs(delta):.2f}%")
            print(f"    Baseline: {baseline_val}")
            print(f"    Current:  {current_val}")
        print()
        print(f"Decision: {reason}")

    # Exit code: 0 if improvement/neutral, 1 if regression
    sys.exit(0 if grade in ['improvement', 'neutral'] else 1)

if __name__ == '__main__':
    main()
