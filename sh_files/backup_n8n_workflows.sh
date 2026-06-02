#!/bin/bash
set -e

FORCE=false
COMMIT=false

for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    --commit)
      COMMIT=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--force] [--commit]"
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

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
MANIFEST="$PROJECT_ROOT/n8n-workflows/manifest.json"

mkdir -p "$WORKFLOWS_DIR"

# Clear stale exports so deleted workflows don't persist in git
rm -f "$WORKFLOWS_DIR"/*.json

# Export all workflows directly into the git-tracked folder via volume mount
docker exec "$N8N_CONTAINER" n8n export:workflow --all --separate \
  --output=/home/node/n8n-workflows/workflows

# Build manifest + inject folder info from postgres
echo "📁 Building manifest and injecting folder info..."
MANIFEST_JSON=$(docker exec "$POSTGRES_CONTAINER" bash -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c \
   "SELECT json_agg(row_to_json(t)) FROM (
      SELECT w.id, w.name, w.active, w.\"isArchived\",
             f.id AS \"folderId\", f.name AS \"folderName\"
      FROM public.workflow_entity w
      LEFT JOIN public.folder f ON w.\"parentFolderId\" = f.id
      ORDER BY w.\"updatedAt\" DESC
    ) t;"' \
  2>/dev/null | tr -d '\n' | grep -o '\[.*\]')

if [[ -n "$MANIFEST_JSON" && "$MANIFEST_JSON" != "null" ]]; then
  # Write manifest.json
  echo "$MANIFEST_JSON" | jq \
    --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    '{lastBackup: $ts, workflows: .}' \
    > "$MANIFEST"
  echo "✅ Manifest written ($(echo "$MANIFEST_JSON" | jq 'length') workflows)"

  # Inject parentFolder + parentFolderId into each individual workflow JSON
  while IFS= read -r entry; do
    wf_id=$(echo "$entry"     | jq -r '.id')
    folder_id=$(echo "$entry"   | jq -r '.folderId // empty')
    folder_name=$(echo "$entry" | jq -r '.folderName // empty')
    [[ -z "$wf_id" ]] && continue
    FILE="$WORKFLOWS_DIR/${wf_id}.json"
    [[ ! -f "$FILE" ]] && continue
    if [[ -n "$folder_id" && -n "$folder_name" ]]; then
      jq --arg name "$folder_name" --arg id "$folder_id" \
        '. + {parentFolder: $name, parentFolderId: $id}' \
        "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
    fi
  done < <(echo "$MANIFEST_JSON" | jq -c '.[]')
  echo "✅ Folder info injected"

  # Remove archived workflow files — upload skips them, so keep the directory in sync
  archived_removed=0
  while IFS= read -r wf_id; do
    FILE="$WORKFLOWS_DIR/${wf_id}.json"
    if [[ -f "$FILE" ]]; then
      rm -f "$FILE"
      archived_removed=$((archived_removed + 1))
    fi
  done < <(echo "$MANIFEST_JSON" | jq -r '.[] | select(.isArchived == true) | .id')
  [[ $archived_removed -gt 0 ]] && echo "🗃️  Removed $archived_removed archived workflow file(s) from workflows/"
else
  echo "⚠️  Could not read workflow data from postgres — skipping manifest and folder injection"
fi

# Commit and push only if --commit flag is passed and something changed
if [[ "$COMMIT" = true ]]; then
  if [[ -n $(git -C "$PROJECT_ROOT" status --porcelain n8n-workflows) ]]; then
    git -C "$PROJECT_ROOT" add n8n-workflows/
    git -C "$PROJECT_ROOT" commit -- n8n-workflows/ -m "Backup: $(date '+%Y-%m-%d %H:%M:%S')"
    git -C "$PROJECT_ROOT" push origin "$BRANCH"
    echo "✅ Workflows backed up and pushed"
  else
    echo "✅ No changes, nothing to commit"
  fi
else
  echo "ℹ️  Skipping commit — run with --commit to commit and push"
fi
