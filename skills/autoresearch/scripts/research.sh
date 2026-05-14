#!/usr/bin/env bash
# Launch N parallel Claude autoresearch agents
# Each agent runs the capacity queue loop M times independently
# Usage: research.sh <num_agents> <exps_per_agent>

NUM_AGENTS="${1:-5}"
EXPS_PER_AGENT="${2:-5}"

if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "Parallel Autoresearch"
    echo "Usage: research.sh <num_agents> <exps_per_agent>"
    echo ""
    echo "Launches num_agents Claude instances in parallel."
    echo "Each instance runs /autoresearch loop exps_per_agent times."
    echo ""
    echo "Example:"
    echo "  ./research.sh 5 5    # 5 agents × 5 experiments = 25 total"
    echo ""
    exit 0
fi

if [[ ! "$NUM_AGENTS" =~ ^[0-9]+$ ]] || [[ ! "$EXPS_PER_AGENT" =~ ^[0-9]+$ ]]; then
    echo "Error: num_agents and exps_per_agent must be positive integers"
    exit 1
fi

echo "Launching $NUM_AGENTS agents × $EXPS_PER_AGENT experiments"
echo ""

log_json() {
    local agent_id=$1
    local exp_idx=$2
    local status=$3
    local msg=$4
    printf '{"timestamp":"%s","agent":%d,"exp":%d,"status":"%s","msg":"%s"}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$agent_id" "$exp_idx" "$status" "$msg"
}

PIDS=()
for agent_id in $(seq 1 "$NUM_AGENTS"); do
    (
        for exp_idx in $(seq 1 "$EXPS_PER_AGENT"); do
            log_json "$agent_id" "$exp_idx" "start" "experiment_starting"

            # Run with timeout; abort if stuck (prompt detected)
            timeout 900 claude --dangerouslySkipPermissions /autoresearch >/dev/null 2>&1
            exit_code=$?

            if [[ $exit_code -eq 124 ]]; then
                log_json "$agent_id" "$exp_idx" "abort" "timeout_or_prompt_detected"
                break
            elif [[ $exit_code -ne 0 ]]; then
                log_json "$agent_id" "$exp_idx" "error" "exit_code_$exit_code"
            else
                log_json "$agent_id" "$exp_idx" "done" "completed"
            fi
        done

        log_json "$agent_id" 0 "agent_done" "all_experiments_finished"
    ) &

    PIDS+=($!)
    log_json "$agent_id" 0 "spawn" "agent_started_pid_${PIDS[-1]}"
done

printf '{"timestamp":"%s","status":"waiting","msg":"all_agents_started"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

FAILED=0
for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    agent_id=$((i + 1))
    if wait "$pid"; then
        log_json "$agent_id" 0 "final" "agent_success"
    else
        log_json "$agent_id" 0 "final" "agent_failed"
        FAILED=$((FAILED + 1))
    fi
done

if [[ $FAILED -eq 0 ]]; then
    printf '{"timestamp":"%s","status":"final","msg":"all_agents_completed_success"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 0
else
    printf '{"timestamp":"%s","status":"final","msg":"agents_failed","count":%d}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FAILED"
    exit 1
fi
