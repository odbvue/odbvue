#!/usr/bin/env bash
set -euo pipefail

# Wrapper for changeset workflow
# Usage: ./create-changeset.sh
# You'll be prompted to:
# - Select which packages changed (usually main app)
# - Choose version bump: patch, minor, or major
# - Write a concise summary

cd apps
pnpm changeset

# Commit the changeset
git add .
git commit -m "changeset: $(ls -t .changeset/*.md 2>/dev/null | head -1 | xargs tail -1)"
echo "✅ Changeset created and committed."

cd ..
