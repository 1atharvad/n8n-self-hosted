#!/bin/bash
set -e

# Config
N8N_CONTAINER="n8n"
DEFAULT_EXPORT_DIR="./n8n-data/git"
EXPORT_DIR="${1:-$DEFAULT_EXPORT_DIR}"
EXPECTED_REMOTE="1atharvad/n8n-workflows.git"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Current branch: $BRANCH"

# Ensure correct remote
CURRENT_REMOTE=$(git remote get-url origin)
if [[ "$CURRENT_REMOTE" != *"$EXPECTED_REMOTE" ]]; then
  echo "❌ Error: origin remote mismatch!"
  echo "Expected: https://github.com/$EXPECTED_REMOTE"
  echo "Found:    $CURRENT_REMOTE"
  exit 1
fi

# Export workflows from container
docker exec $N8N_CONTAINER n8n export:workflow --all --separate --output=/home/node/.n8n/git/workflows

if [[ "$EXPORT_DIR" != "$DEFAULT_EXPORT_DIR" ]]; then
  mkdir -p "$EXPORT_DIR/workflows"
  mv "$DEFAULT_EXPORT_DIR/workflows/"* "$EXPORT_DIR/workflows/"
fi

# Check if there are any changes
if [[ -n $(git status --porcelain workflows) ]]; then
  git add workflows
  git commit -m "Backup: Updated workflows on $(date '+%Y-%m-%d %H:%M:%S')"
  git push origin $BRANCH
else
  echo "✅ No changes in workflows, skipping commit."
fi
