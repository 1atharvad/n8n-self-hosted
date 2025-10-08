#!/bin/bash
set -e

# Config
N8N_CONTAINER="n8n"

# Copy all workflows from n8n-workflow folder to n8n-data folder
cp -r ./n8n-workflow/workflows/* ./n8n-data/git/workflows/

# Move all workflow to n8n
for f in $(ls n8n-data/git/workflows/*.json); do
  docker exec $N8N_CONTAINER n8n import:workflow --input="/home/node/.n8n/git/workflows/$(basename $f)" > /dev/null
  echo "✅ Successfully imported $(basename "$f")"
done
