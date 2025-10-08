#!/bin/bash
set -e

# Config
EXPECTED_REMOTE="1atharvad/n8n-workflows.git"
EXPORT_DIR="./n8n-data/git"

cp -a ./sh_files/backup_n8n_workflows.sh $EXPORT_DIR

# Ensure Git is initialized
if [ ! -d "$EXPORT_DIR/.git" ]; then
  echo "⚠️ Git not initialized in $EXPORT_DIR. Initializing..."
  mkdir -p "$EXPORT_DIR"
  cd "$EXPORT_DIR"
  git init
  git remote add origin "https://github.com/$EXPECTED_REMOTE"
else
  cd "$EXPORT_DIR"
fi

sh ./backup_n8n_workflows.sh