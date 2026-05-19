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
BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)

echo "📂 Project root: $PROJECT_ROOT"
echo "🌿 Branch: $BRANCH"

# Show any uncommitted workflow changes so user can decide
DIRTY=$(git -C "$PROJECT_ROOT" status --porcelain n8n-workflows 2>/dev/null)
if [[ -n "$DIRTY" ]]; then
  echo ""
  echo "⚠️  You have uncommitted changes in n8n-workflows/:"
  git -C "$PROJECT_ROOT" status --short n8n-workflows
  echo ""
fi

if [ "$FORCE" = false ]; then
  read -r -p "This will overwrite local workflow files with exports from n8n. Continue? [y/N] " REPLY
  echo ""
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

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
