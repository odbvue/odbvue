#!/bin/bash

# Create and publish release
# Usage: ./release.sh [-m "message"]

MESSAGE=""

while getopts "m:" opt; do
    case $opt in
        m) MESSAGE="$OPTARG" ;;
        *) echo "Usage: $0 [-m message]"; exit 1 ;;
    esac
done

git checkout main
git pull origin main

# Read version from apps/package.json and increment last number
PACKAGE_JSON_PATH="apps/package.json"
CURRENT_VERSION=$(jq -r '.version' "$PACKAGE_JSON_PATH")

# Parse and increment version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
VERSION_PARTS[-1]=$((${VERSION_PARTS[-1]} + 1))
VERSION_NO_V=$(IFS='.'; echo "${VERSION_PARTS[*]}")
VERSION="v$VERSION_NO_V"

# Save incremented version back to apps/package.json
jq --arg version "$VERSION_NO_V" '.version = $version' "$PACKAGE_JSON_PATH" > "$PACKAGE_JSON_PATH.tmp" && mv "$PACKAGE_JSON_PATH.tmp" "$PACKAGE_JSON_PATH"

# Database project release
if [ -d "db" ]; then
    cd db
    sql /nolog <<EOF
project release -version "v$VERSION_NO_V"
exit
EOF
    git add .
    DB_COMMIT_MESSAGE="db: release $VERSION $([ -n "$MESSAGE" ] && echo "$MESSAGE" || echo "")"
    git commit -m "$DB_COMMIT_MESSAGE"
    cd ..
fi

git add .
COMMIT_MESSAGE="release: $VERSION $([ -n "$MESSAGE" ] && echo "$MESSAGE" || echo "")"
git commit -m "$COMMIT_MESSAGE"

git tag -a "$VERSION" -m "Release $VERSION $([ -n "$MESSAGE" ] && echo "$MESSAGE" || echo "")"
git push origin "$VERSION"

echo "Release $VERSION published successfully"
