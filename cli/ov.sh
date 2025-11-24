#!/bin/bash

# OdbVue CLI wrapper for Unix/Mac/Linux
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/dist/index.js" "$@"
