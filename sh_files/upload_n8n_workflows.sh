#!/bin/bash
set -e

# Config
N8N_CONTAINER="n8n"

# Move all workflow to n8n
for f in $(ls n8n-data/git/workflows/*.json); do
  docker exec $N8N_CONTAINER n8n import:workflow --input="/home/node/.n8n/git/workflows/$(basename $f)" > /dev/null
  echo "✅ Successfully imported $(basename "$f")"
done
