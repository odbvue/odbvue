#!/usr/bin/env bash
set -euo pipefail

# Wrapper for changeset workflow
# Usage: ./submit-pr.sh <Connection>
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

CONNECTION=${1:-$ODBVUE_DB_DEV}

if [ -z "$CONNECTION" ]; then
  echo "Error: Connection not provided and ODBVUE_DB_DEV environment variable not set." >&2
  echo "Usage: $0 [Connection]" >&2
  exit 1
fi

cd db

output=$(sql /nolog << EOF
connect $CONNECTION
project stage
exit
EOF
)

if echo "$output" | grep -q "Stage process failed"; then
    echo "Error: SQL project stage failed." >&2
    echo "$output" >&2
    exit 1
fi

cd ..

# Manual check before staging
echo ""
echo "Please check if staged database content is OK"
echo ""
read -p "Continue? (Y/y to proceed, anything else to exit): " confirm

if [[ "$confirm" != "Y" && "$confirm" != "y" ]]; then
    echo "Aborted by user." >&2
    exit 1
fi

# Stage database changes first
git add db/

cd apps
pnpm changeset

# Commit the changeset and database changes
git add .
summary=$(tail -1 "$(ls -t .changeset/*.md 2>/dev/null | head -1)")
git commit -m "changeset: $summary"
echo "Changeset created and committed."

# Push to remote
branch=$(git rev-parse --abbrev-ref HEAD)
git push -u origin "$branch"
echo "Pushed to origin/$branch"

cd ..
