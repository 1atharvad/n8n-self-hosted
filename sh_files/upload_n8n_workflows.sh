#!/bin/bash
set -e

N8N_CONTAINER="n8n"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_ROOT/n8n-workflows/workflows"

echo "📂 Project root: $PROJECT_ROOT"

if [ ! -d "$WORKFLOWS_DIR" ] || [ -z "$(ls -A "$WORKFLOWS_DIR" 2>/dev/null)" ]; then
  echo "❌ Error: No workflows found in $WORKFLOWS_DIR"
  exit 1
fi

imported=0
for f in "$WORKFLOWS_DIR"/*.json; do
  [ -e "$f" ] || { echo "⚠️  No .json files found in $WORKFLOWS_DIR"; break; }
  docker exec "$N8N_CONTAINER" n8n import:workflow \
    --input="/home/node/n8n-workflows/workflows/$(basename "$f")"
  echo "✅ Imported: $(basename "$f")"
  imported=$((imported + 1))
done

echo "✅ Done: $imported workflow(s) imported"
