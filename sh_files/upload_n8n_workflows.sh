#!/bin/bash
set -e

FORCE=false

for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--force]"
      exit 1
      ;;
  esac
done

N8N_CONTAINER="n8n"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_ROOT/n8n-workflows/workflows"

echo "📂 Project root: $PROJECT_ROOT"

if [ "$FORCE" = false ]; then
  read -r -p "This will overwrite workflows inside n8n with local files. Continue? [y/N] " REPLY
  echo ""
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

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
