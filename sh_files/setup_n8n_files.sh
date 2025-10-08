#!/bin/bash
set -e

CLEAR_INIT=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --clear-init)
      CLEAR_INIT=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# Delete only if flag is set
if [ "$CLEAR_INIT" = true ]; then
  echo "⚠️  Clearing n8n_files..."
  rm -rf n8n_files
  echo "✅ n8n_files cleared."
else
  echo "ℹ️  Skipping n8n_files deletion (no --clear-init flag)."
fi

# Create main folders
mkdir -p ./n8n_files/{audio_files,img_video_files,pdf_files,ppt_files,ppt_images,video_files}

# Make all folders user-writable
chmod -R 775 ./n8n_files

echo "Folders created and permissions updated!"

# Copy assets into n8n_files
if [ -d ./assets ]; then
    cp -r ./assets/* ./n8n_files/
    echo "Assets copied to ./n8n_files"
else
    echo "Warning: ./assets folder does not exist!"
fi

echo "Folders created."

# Build custom n8n nodes
if [ -f package.json ]; then
    echo "Building n8n custom nodes..."
    npm run build-n8n-nodes
    echo "n8n custom nodes build completed."
else
    echo "Warning: package.json not found. Skipping npm build."
fi