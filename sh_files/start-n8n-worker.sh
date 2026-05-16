#!/bin/sh
# Wait for community packages to be installed by the main n8n instance before starting the worker.
# Reads N8N_COMMUNITY_PACKAGES (JSON array) from environment — no manual list to maintain.

NODES_DIR="/home/node/.n8n/nodes/node_modules"
MAX_WAIT=300  # seconds before giving up
INTERVAL=5

if [ -z "$N8N_COMMUNITY_PACKAGES" ]; then
  echo "[wait-for-packages] N8N_COMMUNITY_PACKAGES not set, starting worker immediately."
  exec n8n worker
fi

# Extract package names from the JSON array: [{"name":"pkg","version":"x"}, ...]
PACKAGE_NAMES=$(echo "$N8N_COMMUNITY_PACKAGES" | grep -oE '"name":"[^"]+"' | cut -d'"' -f4)

if [ -z "$PACKAGE_NAMES" ]; then
  echo "[wait-for-packages] No package names parsed, starting worker immediately."
  exec n8n worker
fi

echo "[wait-for-packages] Waiting for packages: $(echo "$PACKAGE_NAMES" | tr '\n' ' ')"

elapsed=0
for pkg in $PACKAGE_NAMES; do
  while [ ! -d "$NODES_DIR/$pkg" ]; do
    if [ "$elapsed" -ge "$MAX_WAIT" ]; then
      echo "[wait-for-packages] Timeout waiting for $pkg after ${MAX_WAIT}s — starting anyway."
      break
    fi
    echo "[wait-for-packages] Waiting for $pkg... (${elapsed}s elapsed)"
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  echo "[wait-for-packages] $pkg is ready."
done

echo "[wait-for-packages] All packages found. Starting n8n worker..."
exec n8n worker
