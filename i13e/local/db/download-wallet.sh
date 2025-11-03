#!/bin/bash
set -e

CONTAINER_NAME="${1:-odbvue-db-dev}"
OUTPUT_PATH="${2:-./wallets/odbvue/wallet.zip}"
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")

mkdir -p "$OUTPUT_DIR"

if command -v podman.exe >/dev/null 2>&1;  then
  PODMAN="podman.exe"
else
  PODMAN="podman"
fi

"$PODMAN" exec "$CONTAINER_NAME" bash -lc '
  set -euo pipefail
  cd /u01/app/oracle/wallets/tls_wallet
  # include dotfiles but NOT "." or ".."
  shopt -s dotglob
  # -r  recursive
  # -X  strip extra file attributes (UID/GID, atimes, etc.)
  # -q  quiet
  # "-" write to stdout
  zip -r -X -q - *
' > "$OUTPUT_PATH"