#!/bin/bash
set -euo pipefail

# Get the scripts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Try to find .env: first in scripts directory, then parent directory
if [ -f "$SCRIPT_DIR/.env" ]; then
    ENV_FILE="$SCRIPT_DIR/.env"
elif [ -f "$SCRIPT_DIR/../.env" ]; then
    ENV_FILE="$SCRIPT_DIR/../.env"
else
    echo "Error: .env file not found"
    exit 1
fi

# Load .env file
source "$ENV_FILE"

echo "Loading .env from: $ENV_FILE"
echo "  v ODBVUE_DB_DEV"
echo "Environment loaded successfully"