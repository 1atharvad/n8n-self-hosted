#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$SCRIPT_DIR")}"

COMMIT=""
FORCE=false

for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    --commit=*)
      COMMIT="${arg#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--commit=<sha>] [--force]"
      exit 1
      ;;
  esac
done

echo "📂 Project root: $PROJECT_ROOT"

# List recent backup commits
BACKUPS=$(git -C "$PROJECT_ROOT" log --oneline --grep="^Backup:" -- n8n-workflows/ 2>/dev/null | head -20)
if [[ -z "$BACKUPS" ]]; then
  echo "❌ No backup commits found in git history"
  exit 1
fi

if [[ -z "$COMMIT" ]]; then
  echo ""
  echo "Recent backups:"
  echo "$BACKUPS"
  echo ""
  read -r -p "Enter commit SHA to roll back to: " COMMIT
  echo ""
fi

# Validate the commit exists and has n8n-workflows changes
if ! git -C "$PROJECT_ROOT" cat-file -e "${COMMIT}^{commit}" 2>/dev/null; then
  echo "❌ Commit '$COMMIT' not found"
  exit 1
fi

COMMIT_MSG=$(git -C "$PROJECT_ROOT" log --oneline -1 "$COMMIT")
echo "Rolling back to: $COMMIT_MSG"

if [[ "$FORCE" = false ]]; then
  read -r -p "This will restore n8n-workflows/ from that commit and re-upload to n8n. Continue? [y/N] " REPLY
  echo ""
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Restore n8n-workflows/ from the chosen commit (working tree only, no index change)
echo "📥 Restoring n8n-workflows/ from $COMMIT..."
git -C "$PROJECT_ROOT" checkout "$COMMIT" -- n8n-workflows/
echo "✅ Files restored"

# Re-upload to n8n
echo ""
"$SCRIPT_DIR/upload_n8n_workflows.sh" --force

# Reset the checkout so git doesn't show staged changes (we don't want to commit this)
git -C "$PROJECT_ROOT" reset HEAD -- n8n-workflows/ 2>/dev/null || true
