#!/usr/bin/env bash
# Starts the agent and voice services on localhost, then the web app on $PORT.
# If any of the three exits, the container exits so the Space restarts it.
set -euo pipefail
cd /home/node/app

# Lock the shared matches' producer controls unless a token is given (personal
# replays with ?seed= stay open to their viewer).
export PRODUCER_TOKEN="${PRODUCER_TOKEN:-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
export AGENTS_URL=http://127.0.0.1:8000 VOICE_URL=http://127.0.0.1:8001

(cd agents && exec .venv/bin/uvicorn sokait_agents.server:app --host 127.0.0.1 --port 8000) &
(cd voice && exec .venv/bin/uvicorn sokait_voice.server:app --host 127.0.0.1 --port 8001) &
node web/.output/server/index.mjs &

wait -n
exit 1
