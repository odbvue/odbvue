#!/bin/bash

# Create and publish release
# Usage: ./release.sh [version] [message]

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Error: version and message are required"
    echo "Usage: ./release.sh [version] [message]"
    exit 1
fi

VERSION=$1
MESSAGE=$2

git checkout main
git pull origin main

# Bump version in package.json files (remove v prefix if present)
VERSION_NO_V=${VERSION#v}

# Update package.json in apps directory
if [ -f "apps/package.json" ]; then
    jq --arg version "$VERSION_NO_V" '.version = $version' apps/package.json > apps/package.json.tmp && mv apps/package.json.tmp apps/package.json
fi

# todo later: sql /nolog

git add .
git commit -m "release: $VERSION $MESSAGE"

git tag -a "$VERSION" -m "Release $VERSION $MESSAGE"
git push origin "$VERSION"

echo "Release $VERSION published successfully"
