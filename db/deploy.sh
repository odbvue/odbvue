#!/bin/bash
set -euo pipefail

# Name
NAME="odbvue-db"

# Check for required VERSION argument
if [ $# -lt 1 ]; then
    echo "Error: Missing required argument"
    echo "Usage: ./deploy.sh [version]"
    exit 1
fi
VERSION="$1"
echo "Deploying version: $VERSION"

# Load environment variables from .env file
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

# Decode and extract wallet from base64
echo "Setting up wallet..."
WALLET_DIR="/tmp/wallet"
mkdir -p "$WALLET_DIR"
if [ -n "${ADB_WALLET_BASE64:-}" ]; then
    echo "$ADB_WALLET_BASE64" | base64 -d > "$WALLET_DIR/wallet.zip"
    unzip -P "${ADB_WALLET_PASSWORD}" -q -o "$WALLET_DIR/wallet.zip" -d "$WALLET_DIR"
    echo "Wallet extracted to $WALLET_DIR"
else
    echo "Warning: ADB_WALLET_BASE64 not set. Trying to connect without wallet..."
fi
export TNS_ADMIN="$WALLET_DIR"

# Release
EDITION="${ADB_SCHEMA_NAME}_$(echo "$VERSION" | tr . _)"
EDITION="${EDITION^^}"   # uppercase (bash)
echo "Connecting to ${ADB_TNS_ALIAS}..."
sql -nohistory "${ADB_USER}/${ADB_PASSWORD}@${ADB_TNS_ALIAS}" << ENDSQL
prompt Connected..
define ADB_SCHEMA_NAME = '${ADB_SCHEMA_NAME}'
define ADB_SCHEMA_PASSWORD = '${ADB_SCHEMA_PASSWORD}'
define VERSION = '${VERSION}'
define EDITION = '${EDITION}'
define APP_CONFIG = '${APP_CONFIG}'
prompt Variables defined..
project gen-artifact -name $NAME -version $VERSION -format zip
prompt Artifact generated..
project deploy -file ./artifact/$NAME-$VERSION.zip -log-path .
prompt Artifact deployed..
lb tag -tag "$VERSION"
prompt Tagged..
exit
ENDSQL

# === For Testing ===
# project stage add-custom -file-name ./dist/utils/777_marker.sql
# prompt Staged..
# project release -version $VERSION
# prompt Released..
