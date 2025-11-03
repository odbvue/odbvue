#!/bin/bash
# copy.sh - Copy site files to remote directory
# Usage: bash copy.sh <ssh-key> <remote-host> [remoteDir]
# Example: bash copy.sh ~/.ssh/odbvue opc@79.72.16.185 ~/deploy

set -euo pipefail

SSH_KEY="${1:-}"
REMOTE_HOST="${2:-}"
REMOTE_DIR="${3:-~/deploy}"

if [[ -z "$SSH_KEY" || -z "$REMOTE_HOST" ]]; then
    echo "Usage: bash copy.sh <ssh-key> <remote-host> [remoteDir]"
    echo "Example: bash copy.sh ~/.ssh/odbvue opc@79.72.16.185 ~/deploy"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITES_YAML_PATH="$SCRIPT_DIR/sites.yaml"

# Expand SSH key path
SSH_KEY="${SSH_KEY/#\~/$HOME}"

# Parse sites.yaml and collect siteName and localPath
declare -a SITES
declare -A LOCAL_PATHS

current_site=""
while IFS= read -r line; do
    if [[ $line =~ ^[[:space:]]*-[[:space:]]*siteName:[[:space:]]*\"([^\"]+)\" ]]; then
        current_site="${BASH_REMATCH[1]}"
        SITES+=("$current_site")
    elif [[ -n "$current_site" && $line =~ ^[[:space:]]*localPath:[[:space:]]*\"([^\"]+)\" ]]; then
        LOCAL_PATHS["$current_site"]="${BASH_REMATCH[1]}"
    fi
done < "$SITES_YAML_PATH"

# Create remote directory first
echo "Creating remote $REMOTE_DIR directory..."
ssh -i "$SSH_KEY" "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# Copy all script files to remote (including .ssl folder)
echo "Copying script files..."
scp -q -i "$SSH_KEY" -r "$SCRIPT_DIR"/* "$REMOTE_HOST:$REMOTE_DIR/"
scp -q -i "$SSH_KEY" -r "$SCRIPT_DIR/.ssl" "$REMOTE_HOST:$REMOTE_DIR/.ssl"
echo "  Script files copied"

# Copy each site
for site in "${SITES[@]}"; do
    local_path="${LOCAL_PATHS[$site]}"
    
    # Expand ~ to home directory
    local_path="${local_path/#\~/$HOME}"
    
    # Resolve relative paths
    if [[ $local_path == ../* ]]; then
        local_path="$(cd "$SCRIPT_DIR" && cd "$local_path" && pwd)"
    fi
    
    echo "Copying $site..."
    
    # scp -r /path/to/files user@host:$REMOTE_DIR/siteName (quiet mode)
    scp -q -i "$SSH_KEY" -r "$local_path" "$REMOTE_HOST:$REMOTE_DIR/$site"
    echo "  Copied"
done

echo "Done!"
