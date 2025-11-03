#!/bin/bash
set -e

CONTAINER_NAME="${1:-odbvue-db-dev}"

# Determine podman command (handle Windows)
if command -v podman.exe >/dev/null 2>&1; then
  PODMAN="podman.exe"
else
  PODMAN="podman"
fi

echo "Stopping container: $CONTAINER_NAME"
$PODMAN stop "$CONTAINER_NAME" 2>/dev/null || true

echo "Removing container: $CONTAINER_NAME"
$PODMAN rm "$CONTAINER_NAME" 2>/dev/null || true

# Find and remove the associated pod
# When using compose, the pod is named pod_<service-name> (e.g., pod_db)
echo "Looking for associated pods..."
POD_ID=$($PODMAN ps -ap --filter "name=$CONTAINER_NAME" --format '{{.PodName}}' 2>/dev/null | head -n1)

if [ -n "$POD_ID" ]; then
  echo "Removing pod: $POD_ID"
  $PODMAN pod rm "$POD_ID" 2>/dev/null || true
else
  # Try removing by common naming pattern (pod_<service-name>)
  echo "Removing pod by service name pattern..."
  $PODMAN pod rm "pod_db" 2>/dev/null || true
fi

echo "Successfully removed $CONTAINER_NAME"
