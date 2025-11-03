#!/bin/bash
set -e

if command -v podman.exe >/dev/null 2>&1;  then
  PODMAN="podman.exe"
else
  PODMAN="podman"
fi

"$PODMAN" compose up -d --build