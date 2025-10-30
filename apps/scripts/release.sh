#!/bin/bash

# Release script for managing version releases
# Usage: ./release.sh -v x.y.z -m "release-name"

# Determine repo root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERSION=""
RELEASE_NAME=""

# Parse command line arguments
while getopts "v:m:" opt; do
  case $opt in
    v)
      VERSION="$OPTARG"
      ;;
    m)
      RELEASE_NAME="$OPTARG"
      ;;
    *)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 -v x.y.z -m \"release-name\""
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$VERSION" ] || [ -z "$RELEASE_NAME" ]; then
  echo "Error: Both -v and -m arguments are required"
  echo "Usage: $0 -v x.y.z -m \"release-name\""
  exit 1
fi

# Exit on any error
set -e

echo "Starting release process for v$VERSION - $RELEASE_NAME"
echo ""

# Checkout main and pull latest changes
echo "Checking out main branch..."
cd "$REPO_ROOT"
git checkout main

echo "Pulling latest changes..."
git pull

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

# Checkout main again
echo "Checking out main branch..."
git checkout main

# Pull latest changes
echo "Pulling latest changes..."
git pull

# Create and push tag
echo "Creating tag v$VERSION..."
git tag -a v$VERSION -m "Release v$VERSION - $RELEASE_NAME"

echo "Pushing tag to origin..."
git push origin v$VERSION

echo ""
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

echo ""
echo "Release v$VERSION ($RELEASE_NAME) completed successfully!"
