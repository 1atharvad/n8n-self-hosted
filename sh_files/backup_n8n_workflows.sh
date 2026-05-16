#!/bin/bash
set -e

N8N_CONTAINER="n8n"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_ROOT/n8n-workflows/workflows"
BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)

echo "📂 Project root: $PROJECT_ROOT"
echo "🌿 Branch: $BRANCH"

mkdir -p "$WORKFLOWS_DIR"

# Clear stale exports so deleted workflows don't persist in git
rm -f "$WORKFLOWS_DIR"/*.json

# Export all workflows directly into the git-tracked folder via volume mount
docker exec "$N8N_CONTAINER" n8n export:workflow --all --separate \
  --output=/home/node/n8n-workflows/workflows

# Commit and push only if something changed
if [[ -n $(git -C "$PROJECT_ROOT" status --porcelain n8n-workflows) ]]; then
  git -C "$PROJECT_ROOT" add n8n-workflows/
  git -C "$PROJECT_ROOT" commit -m "Backup: $(date '+%Y-%m-%d %H:%M:%S')"
  git -C "$PROJECT_ROOT" push origin "$BRANCH"
  echo "✅ Workflows backed up and pushed"
else
  echo "✅ No changes, nothing to commit"
fi
