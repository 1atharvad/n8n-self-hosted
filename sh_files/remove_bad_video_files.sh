#!/bin/bash

# Usage: remove_bad_video_files.sh <dir>
#
# Scans <dir> for non-.txt files that are corrupt and deletes them;
# prints the basename of files kept.

dir="$1"

if [ -z "$dir" ]; then
  echo "Usage: $0 <video_dir>" >&2
  exit 1
fi

[ ! -d "$dir" ] && exit 0

find "$dir" -type f ! -name "*.txt" | sort | while read -r f; do
  if [ -s "$f" ] && ffprobe -v error -i "$f" 2>&1 | grep -q "."; then
    rm "$f"
  else
    basename "$f"
  fi
done
