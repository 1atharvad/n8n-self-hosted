#!/bin/sh
set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 [--confirm] [--folders folder1,folder2,...]"
    echo "Examples:"
    echo "  $0 --confirm                          # Clean all folders"
    echo "  $0 --confirm --folders pdf_files      # Clean only pdf_files"
    echo "  $0 --confirm --folders pdf_files,audio_files  # Clean specific folders"
    echo ""
    echo "Available folders: img_video_files, pdf_files, ppt_files, ppt_images, audio_files"
    exit 1
}

# Initialize variables
CONFIRM=false
FOLDERS=""
ALL_FOLDERS="img_video_files pdf_files ppt_files ppt_images audio_files"

# Parse arguments
while [ $# -gt 0 ]; do
    case $1 in
        --confirm)
            CONFIRM=true
            shift
            ;;
        --folders)
            FOLDERS="$2"
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

# Check if confirm flag was provided
if [ "$CONFIRM" = false ]; then
    >&2 echo "Error: --confirm flag is required for safety"
    show_usage
fi

# Determine which folders to clean
if [ -z "$FOLDERS" ]; then
    FOLDERS_TO_CLEAN="$ALL_FOLDERS"
    >&2 echo "Cleaning ALL folders"
else
    # Replace commas with spaces for iteration
    FOLDERS_TO_CLEAN=$(echo "$FOLDERS" | tr ',' ' ')
    >&2 echo "Cleaning specific folders: $FOLDERS_TO_CLEAN"
fi

# Define paths (try absolute first, then relative)
ABSOLUTE_BASE="/n8n_files"
RELATIVE_BASE="n8n_files"

# Determine which base path to use
if [ -d "$ABSOLUTE_BASE" ]; then
    BASE_PATH="$ABSOLUTE_BASE"
    >&2 echo "Using absolute paths"
elif [ -d "$RELATIVE_BASE" ]; then
    BASE_PATH="$RELATIVE_BASE"
    >&2 echo "Using relative paths"
else
    >&2 echo "Error: n8n_files directory not found in either:"
    >&2 echo "   - $ABSOLUTE_BASE"
    >&2 echo "   - $RELATIVE_BASE"
    exit 1
fi

# Clean specified folders
cleaned_count=0
for folder in $FOLDERS_TO_CLEAN; do
    folder_path="$BASE_PATH/$folder"

    if [ -d "$folder_path" ]; then
        >&2 echo "Cleaning $folder..."
        rm -f "$folder_path"/* || {
            >&2 echo "Warning: Could not clean all files in $folder"
        }
        cleaned_count=$((cleaned_count + 1))
    else
        >&2 echo "Warning: Directory $folder_path does not exist"
    fi
done

>&2 echo "Successfully cleaned $cleaned_count folders"
echo "Cleanup completed: $cleaned_count folders processed"