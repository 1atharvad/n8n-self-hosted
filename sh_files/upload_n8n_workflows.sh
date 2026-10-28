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

N8N_CONTAINER="${N8N_CONTAINER:-n8n}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$SCRIPT_DIR")}"
WORKFLOWS_DIR="$PROJECT_ROOT/n8n-workflows/workflows"
MANIFEST="$PROJECT_ROOT/n8n-workflows/manifest.json"

echo "📂 Project root: $PROJECT_ROOT"

# Source .env for N8N_API_KEY and WEBHOOK_TUNNEL_URL
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

N8N_URL="${WEBHOOK_TUNNEL_URL:-}"
N8N_API_KEY="${N8N_API_KEY:-}"

if [[ -z "$N8N_URL" ]]; then
  echo "❌ WEBHOOK_TUNNEL_URL is not set in .env"
  exit 1
fi
if [[ -z "$N8N_API_KEY" ]]; then
  echo "❌ N8N_API_KEY is not set in .env"
  exit 1
fi

# Verify containers are running
if ! docker inspect "$N8N_CONTAINER" > /dev/null 2>&1; then
  echo "❌ Container '$N8N_CONTAINER' is not running"
  exit 1
fi
if ! docker inspect "$POSTGRES_CONTAINER" > /dev/null 2>&1; then
  echo "❌ Container '$POSTGRES_CONTAINER' is not running"
  exit 1
fi

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

# ── Helpers ────────────────────────────────────────────────────────────────────
pg_query() {
  echo "$1" | docker exec -i "$POSTGRES_CONTAINER" bash -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A'
}

n8n_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -X "$method" "$N8N_URL/api/v1$path" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -s -X "$method" "$N8N_URL/api/v1$path" \
      -H "X-N8N-API-KEY: $N8N_API_KEY"
  fi
}

# ── Get project ID from postgres ──────────────────────────────────────────────
echo "⚙️  Looking up personal project ID..."
N8N_PROJECT_ID=$(pg_query "SELECT id FROM public.project WHERE type = 'personal' LIMIT 1;" | head -1 | tr -d '[:space:]')
if [[ -z "$N8N_PROJECT_ID" ]]; then
  echo "❌ Could not resolve project ID from postgres"
  exit 1
fi
echo "✅ Project ID: $N8N_PROJECT_ID"

# ── Wipe all existing workflows ───────────────────────────────────────────────
echo "🗑️  Wiping existing workflows..."
ALL_WF=$(n8n_api GET "/workflows?limit=250" 2>/dev/null)
WF_IDS=$(echo "$ALL_WF" | jq -r '.data[].id' 2>/dev/null)
wipe_count=0
for wf_id in $WF_IDS; do
  n8n_api DELETE "/workflows/$wf_id" > /dev/null 2>&1 || true
  wipe_count=$((wipe_count + 1))
done
echo "✅ Wiped $wipe_count workflow(s)"

# ── Wipe existing folders ─────────────────────────────────────────────────────
echo "🗑️  Wiping existing folders..."
FOLDERS_JSON=$(n8n_api GET "/projects/$N8N_PROJECT_ID/folders" 2>/dev/null || echo '{"data":[]}')
while IFS= read -r folder_id; do
  [[ -z "$folder_id" || "$folder_id" == "null" ]] && continue
  n8n_api DELETE "/projects/$N8N_PROJECT_ID/folders/$folder_id" > /dev/null 2>&1 || true
done < <(echo "$FOLDERS_JSON" | jq -r '.data[].id' 2>/dev/null)
echo "✅ Folders wiped"
FOLDERS_JSON='{"data":[]}'


# ── Load archived IDs from manifest ───────────────────────────────────────────
ARCHIVED_IDS=""
if [[ -f "$MANIFEST" ]]; then
  ARCHIVED_IDS=$(jq -r '.workflows[] | select(.isArchived == true) | .id' "$MANIFEST" 2>/dev/null)
  archived_count=$(echo "$ARCHIVED_IDS" | grep -c . 2>/dev/null || echo 0)
  echo "📋 Manifest loaded ($archived_count archived workflow(s) will be skipped)"
else
  echo "⚠️  No manifest.json found — archived workflows will not be skipped"
fi

# ── Import + folder assignment ─────────────────────────────────────────────────
imported=0
skipped=0
moved=0
created_folders=0
failed=0
declare -A ID_MAP  # old workflow id (from filename/export) -> new id assigned on import

for f in "$WORKFLOWS_DIR"/*.json; do
  [ -e "$f" ] || { echo "⚠️  No .json files found in $WORKFLOWS_DIR"; break; }

  WF_ID=$(jq -r '.id' "$f")
  WF_NAME=$(jq -r '.name' "$f")
  PARENT_FOLDER=$(jq -r '.parentFolder // empty' "$f")
  PARENT_FOLDER_ID=$(jq -r '.parentFolderId // empty' "$f")

  # Skip archived workflows
  if echo "$ARCHIVED_IDS" | grep -qx "$WF_ID"; then
    echo "⏭️  Skipped (archived): $WF_NAME"
    skipped=$((skipped + 1))
    continue
  fi

  # Strip custom fields before importing — n8n rejects unknown top-level fields
  TMP="$WORKFLOWS_DIR/.tmp_${WF_ID}.json"
  jq 'del(.parentFolder, .parentFolderId)' "$f" > "$TMP"

  if ! docker exec "$N8N_CONTAINER" n8n import:workflow \
    --input="/home/node/n8n-workflows/workflows/.tmp_${WF_ID}.json" > /dev/null 2>&1; then
    echo "⚠️  Failed to import: $WF_NAME"
    rm -f "$TMP"
    failed=$((failed + 1))
    continue
  fi
  rm -f "$TMP"
  echo "✅ Imported: $WF_NAME"
  imported=$((imported + 1))

  # On Postgres, n8n assigns a NEW id on import instead of keeping the one from
  # the file — record old -> new so Execute Workflow references can be fixed up
  # after every workflow has been imported (see remap phase below).
  ESCAPED_NAME=$(echo "$WF_NAME" | sed "s/'/''/g")
  NEW_ID=$(pg_query "SELECT id FROM public.workflow_entity WHERE name = '$ESCAPED_NAME' ORDER BY \"createdAt\" DESC LIMIT 1;" | head -1 | tr -d '[:space:]')
  if [[ -n "$NEW_ID" ]]; then
    ID_MAP["$WF_ID"]="$NEW_ID"
  else
    echo "   ⚠️  Could not resolve new id for '$WF_NAME' — sub-workflow references to it won't be remapped"
  fi

  # Assign to folder via REST API
  if [[ -n "$PARENT_FOLDER" ]]; then
    FOLDER_ID=""

    # 1. Try stored ID first (same instance fast path)
    if [[ -n "$PARENT_FOLDER_ID" ]]; then
      FOLDER_ID=$(echo "$FOLDERS_JSON" | jq -r --arg id "$PARENT_FOLDER_ID" \
        '.data[] | select(.id == $id) | .id' 2>/dev/null)
    fi

    # 2. Fall back to name lookup
    if [[ -z "$FOLDER_ID" ]]; then
      FOLDER_ID=$(echo "$FOLDERS_JSON" | jq -r --arg name "$PARENT_FOLDER" \
        '.data[] | select(.name == $name) | .id' 2>/dev/null | head -1)
    fi

    # 3. Create folder via REST if not found
    if [[ -z "$FOLDER_ID" ]]; then
      echo "   📁 Creating folder: $PARENT_FOLDER"
      NEW_FOLDER=$(n8n_api POST "/projects/$N8N_PROJECT_ID/folders" "{\"name\": \"$PARENT_FOLDER\"}")
      FOLDER_ID=$(echo "$NEW_FOLDER" | jq -r '.id' 2>/dev/null)
      if [[ -z "$FOLDER_ID" || "$FOLDER_ID" == "null" ]]; then
        echo "   ⚠️  Failed to create folder '$PARENT_FOLDER' — workflow left at root"
        continue
      fi
      FOLDERS_JSON=$(echo "$FOLDERS_JSON" | jq --argjson f "$NEW_FOLDER" '.data += [$f]')
      created_folders=$((created_folders + 1))
    fi

    pg_query "UPDATE public.workflow_entity SET \"parentFolderId\" = '$FOLDER_ID' WHERE id = '$WF_ID';" > /dev/null
    echo "   📂 Assigned to folder: $PARENT_FOLDER"
    moved=$((moved + 1))
  fi
done

echo ""
echo "✅ Done: $imported imported, $skipped skipped (archived), $failed failed, $moved moved to folders, $created_folders folder(s) created"

# ── Remap Execute Workflow (sub-workflow) references to the new ids ───────────
# Postgres-backed n8n assigns a new id to every imported workflow instead of
# keeping the one from the export, so any node referencing another workflow by
# its old id (parameters.workflowId.value) is now pointing at nothing. Rebuild
# those references using the old->new id map collected during import.
echo ""
echo "🔗 Remapping Execute Workflow references..."

MAP_JSON="{}"
for old_id in "${!ID_MAP[@]}"; do
  MAP_JSON=$(jq -n --argjson base "$MAP_JSON" --arg k "$old_id" --arg v "${ID_MAP[$old_id]}" '$base + {($k): $v}')
done

remapped_workflows=0
remapped_refs=0
for new_id in $(printf '%s\n' "${ID_MAP[@]}" | sort -u); do
  WF_JSON=$(n8n_api GET "/workflows/$new_id")

  UPDATED_NODES=$(echo "$WF_JSON" | jq --argjson map "$MAP_JSON" '
    [.nodes[] |
      if ($map[(.parameters.workflowId.value // "")] // null) != null
      then (.parameters.workflowId.value as $old |
            .parameters.workflowId.value = $map[$old] |
            .parameters.workflowId.cachedResultUrl = ("/workflow/" + $map[$old]))
      else .
      end
    ]')

  REF_COUNT=$(echo "$WF_JSON" | jq --argjson map "$MAP_JSON" '
    [.nodes[] | select(($map[(.parameters.workflowId.value // "")] // null) != null)] | length')

  if [[ "$REF_COUNT" -gt 0 ]]; then
    WF_NAME_FOR_LOG=$(echo "$WF_JSON" | jq -r '.name')
    BODY=$(echo "$WF_JSON" | jq --argjson nodes "$UPDATED_NODES" '{name, nodes: $nodes, connections, settings, staticData}')
    if n8n_api PUT "/workflows/$new_id" "$BODY" > /dev/null 2>&1; then
      echo "✅ Remapped $REF_COUNT reference(s) in: $WF_NAME_FOR_LOG"
      remapped_workflows=$((remapped_workflows + 1))
      remapped_refs=$((remapped_refs + REF_COUNT))
    else
      echo "⚠️  Failed to push remapped references for: $WF_NAME_FOR_LOG"
    fi
  fi
done
echo "✅ Remap done: $remapped_refs reference(s) fixed across $remapped_workflows workflow(s)"

# ── Restore data tables ───────────────────────────────────────────────────────
DATA_DIR="$PROJECT_ROOT/n8n-workflows/data"
if [ -f "$DATA_DIR/data_tables_restore.sql" ]; then
  echo ""
  echo "📦 Restoring data tables..."
  TABLES=$(grep -oP '(?<=INSERT INTO public\.)[^\s(]+' "$DATA_DIR/data_tables_restore.sql" | sort -u | tr '\n' ' ')
  grep -Ev "^\\\\(un)?restrict" "$DATA_DIR/data_tables_restore.sql" | \
    sed "s/__PROJECT_ID__/$N8N_PROJECT_ID/g" | \
    docker exec -i "$POSTGRES_CONTAINER" bash -c \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' > /dev/null
  echo "✅ Data tables restored: $TABLES"
else
  echo ""
  echo "ℹ️  No data_tables_restore.sql found — skipping data table restore"
fi
