#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

run_dev() {
  local service_dir="$1"
  (
    cd "$ROOT_DIR/$service_dir"
    echo "Starting dev server in $service_dir..."
    npm run dev
  ) &
  PIDS+=("$!")
}

cleanup() {
  echo
  echo "Stopping dev servers..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}

trap cleanup INT TERM

run_dev "api"
run_dev "client"

wait
