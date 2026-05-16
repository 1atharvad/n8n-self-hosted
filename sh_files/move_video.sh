#!/bin/bash
set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 --filename <filename>"
    echo "Example: $0 --filename yt-ch1-epoch-6_pseudo_slide-1-1.mp4"
    exit 1
}

# Initialize variables
FILENAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --filename)
            FILENAME="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            echo "❌ Error: Unknown option $1"
            show_usage
            ;;
    esac
done

# Check if filename was provided
if [ -z "$FILENAME" ]; then
    echo "❌ Error: --filename argument is required"
    show_usage
fi

# Parse epoch and file parts from filename: {type}-epoch-{number}_{rest}
# e.g. yt-ch1-epoch-6_pseudo_slide-1-1.mp4
# EPOCH_PART = yt-ch1-epoch-6  →  EPOCH_DIR = yt-ch1-epoch_6
# FILE_PART  = pseudo_slide-1-1.mp4
EPOCH_PART="${FILENAME%%_*}"
FILE_PART="${FILENAME#*_}"
EPOCH_DIR="${EPOCH_PART%-*}_${EPOCH_PART##*-}"

if [ -z "$FILE_PART" ] || [ "$FILE_PART" = "$FILENAME" ]; then
    >&2 echo "Error: Filename must follow the format {type}-epoch-<N>_<name>, got: $FILENAME"
    exit 1
fi

# Define paths (try absolute first, then relative)
ABSOLUTE_SOURCE="/n8n_files/video_files/$FILENAME"
RELATIVE_SOURCE="n8n_files/video_files/$FILENAME"
ABSOLUTE_DEST="/n8n_files/img_video_files/$EPOCH_DIR/"
RELATIVE_DEST="n8n_files/img_video_files/$EPOCH_DIR/"

# Determine which paths to use
if [ -f "$ABSOLUTE_SOURCE" ]; then
    SOURCE_PATH="$ABSOLUTE_SOURCE"
    DEST_PATH="$ABSOLUTE_DEST"
    >&2 echo "Using absolute paths"
elif [ -f "$RELATIVE_SOURCE" ]; then
    SOURCE_PATH="$RELATIVE_SOURCE"
    DEST_PATH="$RELATIVE_DEST"
    >&2 echo "Using relative paths"
else
    >&2 echo "⏭️ Skipping: $FILENAME not found, skipping"
    exit 0
fi

# Create epoch subfolder if it doesn't exist
mkdir -p "$DEST_PATH"

# Perform the move operation
>&2 echo "Moving $FILENAME → $DEST_PATH$FILE_PART"
mv "$SOURCE_PATH" "${DEST_PATH}${FILE_PART}" || {
    >&2 echo "❌ Error: Failed to move file"
    exit 1
}

>&2 echo "✅ Successfully moved: $FILENAME"
echo "${DEST_PATH}${FILE_PART}"
