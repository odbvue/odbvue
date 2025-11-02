#!/usr/bin/env bash
set -euo pipefail

# Wrapper for changeset workflow
# Usage: ./create-pr.sh
# You'll be prompted to:
# - Select which packages changed (usually main app)
# - Choose version bump: patch, minor, or major
# - Write a concise summary

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "Error: You have uncommitted changes. Please commit or stash them first." >&2
  git status -s
  exit 1
fi

cd apps
pnpm changeset

# Commit the changeset
git add .
git commit -m "changeset: $(ls -t .changeset/*.md 2>/dev/null | head -1 | xargs tail -1)"
echo "Changeset created and committed."

# Push to remote
branch=$(git rev-parse --abbrev-ref HEAD)
git push -u origin "$branch"
echo "Pushed to origin/$branch"

cd ..
