#!/bin/sh
set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 --filename <filename>"
    echo "Example: $0 --filename video.mp4"
    exit 1
}

# Initialize variables
FILENAME=""

# Parse arguments
while [ $# -gt 0 ]; do
    case $1 in
        --filename)
            FILENAME="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            >&2 echo "Error: Unknown option $1"
            show_usage
            ;;
    esac
done

# Check if filename was provided
if [ -z "$FILENAME" ]; then
    >&2 echo "Error: --filename argument is required"
    show_usage
fi

# Define paths (try absolute first, then relative)
ABSOLUTE_SOURCE="/n8n_files/$FILENAME"
RELATIVE_SOURCE="n8n_files/$FILENAME"
ABSOLUTE_DEST="/n8n_files/img_video_files/"
RELATIVE_DEST="n8n_files/img_video_files/"

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
    >&2 echo "Error: File not found in either:"
    >&2 echo "   - $ABSOLUTE_SOURCE"
    >&2 echo "   - $RELATIVE_SOURCE"
    exit 1
fi

# Check if destination directory exists
if [ ! -d "$DEST_PATH" ]; then
    >&2 echo "Error: Destination directory does not exist: $DEST_PATH"
    exit 1
fi

# Perform the copy operation
>&2 echo "Copying $FILENAME to img_video_files..."
cp "$SOURCE_PATH" "$DEST_PATH" || {
    >&2 echo "Error: Failed to copy file"
    exit 1
}

>&2 echo "Successfully copied: $FILENAME"
echo "$FILENAME"