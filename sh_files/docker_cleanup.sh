#!/bin/bash
set -e

LOG_FILE="/var/log/docker-cleanup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log "=== Docker cleanup started ==="

# Remove unused images (keeps images used by running containers)
log "Removing unused images..."
docker image prune -a -f 2>&1 | tee -a "$LOG_FILE"

# Clear build cache
log "Clearing build cache..."
docker builder prune -f 2>&1 | tee -a "$LOG_FILE"

# Remove unused volumes (excludes named volumes in use)
log "Removing unused volumes..."
docker volume prune -f 2>&1 | tee -a "$LOG_FILE"

# Remove stopped containers
log "Removing stopped containers..."
docker container prune -f 2>&1 | tee -a "$LOG_FILE"

log "=== Docker cleanup complete ==="
log "Disk usage after cleanup:"
df -h / 2>&1 | tee -a "$LOG_FILE"
