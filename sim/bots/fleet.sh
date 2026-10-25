#!/usr/bin/env bash
# Plays <raids> raids per bot style in each zone, on half the cores, then prints the report.
# usage: [JOBS=n] bash sim/bots/fleet.sh [raids per style and zone] [zones...]
set -euo pipefail
cd "$(dirname "$0")/../.."
raids=${1:-20}
shift || true
zones=("$@")
[ ${#zones[@]} -eq 0 ] && zones=(0 1 2 3 4)
jobs=${JOBS:-$(( $(nproc) / 2 ))}
chunk=2
out=sim/out/bots
mkdir -p "$out"
rm -f "$out"/*.jsonl
tasks=()
for z in "${zones[@]}"; do
  for ((i = 0; i < raids; i += chunk)); do tasks+=("$z $i"); done
done
printf '%s\n' "${tasks[@]}" | xargs -P "$jobs" -L 1 bash -c \
  'nice -n 19 npx vite-node -c sim/bots/vite.config.ts sim/bots/run.ts "$0" '"$chunk"' > '"$out"'/z$0-$1.jsonl'
cat "$out"/z*.jsonl > sim/out/bots.jsonl
npx vite-node -c sim/bots/vite.config.ts sim/bots/report.ts sim/out/bots.jsonl
