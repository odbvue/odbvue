#!/bin/bash
set -e

CONTAINER_NAME="${1:-odbvue-db-dev}"
podman logs --tail 50 "$CONTAINER_NAME"