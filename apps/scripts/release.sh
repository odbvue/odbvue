#!/bin/bash

# Release script for managing version releases
# Works on Windows (Git Bash, WSL) and Unix-like systems
# Usage: ./release2.sh
# Usage: ./release2.sh -m "release-name"
# Usage: bash ./release2.sh -m "release-name"
# Usage (Windows PowerShell): bash ./scripts/release2.sh -m "release-name"

# Determine repo root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RELEASE_NAME=""

# Parse command line arguments
while getopts "m:" opt; do
  case $opt in
    m)
      RELEASE_NAME="$OPTARG"
      ;;
    *)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 [-m \"release-name\"]" >&2
      exit 1
      ;;
  esac
done

# Exit on any error
set -e

# Checkout main and pull latest changes first
echo "Checking out main branch..."
cd "$REPO_ROOT"
git checkout main

echo "Pulling latest changes..."
git pull
echo ""

# Build the application (which auto-increments version)
echo "Building application..."
cd "$REPO_ROOT/apps"
pnpm build
pnpm wiki:build

# Extract version from package.json
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from package.json" >&2
  exit 1
fi

# Build release message
if [ -z "$RELEASE_NAME" ]; then
  RELEASE_MSG="v$VERSION"
  echo "Starting release process for v$VERSION"
else
  RELEASE_MSG="v$VERSION - $RELEASE_NAME"
  echo "Starting release process for v$VERSION - $RELEASE_NAME"
fi
echo ""

# Create DB Release
echo "Generating database artifact..."
cd "$REPO_ROOT/db"

sql /nolog <<SQL
project release -version v$VERSION
project gen-artifact -version v$VERSION
exit
SQL

echo "Staging database changes..."
cd "$REPO_ROOT"
git add db/
git commit -m "chore(db-release): v$VERSION" || echo "No DB changes to commit"

echo "Pushing database changes..."
git push

# Create release branch
echo "Creating release branch release/$VERSION..."
git checkout -b release/$VERSION

# Stage package.json
echo "Staging apps/package.json..."
git add apps/package.json

# Commit changes
echo "Committing changes..."
git commit -m "chore(release): v$VERSION"

# Push release branch
echo "Pushing release branch to origin..."
git push -u origin release/$VERSION

# Pull latest from main (in case of concurrent changes)
echo "Pulling latest changes from main..."
cd "$REPO_ROOT"
git checkout main
git pull

# Create and push tag
echo "Creating tag v$VERSION..."
git tag -a v$VERSION -m "Release $RELEASE_MSG"

echo "Pushing tag to origin..."
git push origin main
git push origin v$VERSION

echo ""
echo "Release process for $RELEASE_MSG completed successfully."
