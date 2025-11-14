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

# Read version from apps/package.json
# (version is already bumped by GitHub Actions changeset workflow)
PACKAGE_JSON_PATH="apps/package.json"
VERSION_NO_V=$(jq -r '.version' "$PACKAGE_JSON_PATH")
VERSION="v$VERSION_NO_V"

# Database project release
if [ -d "db" ]; then
    cd db
    sql /nolog <<EOF
project release -version "v$VERSION_NO_V"
exit
EOF
    cd ..
fi

git add .
COMMIT_MESSAGE="release: $VERSION $([ -n "$MESSAGE" ] && echo "$MESSAGE" || echo "")"
git commit -m "$COMMIT_MESSAGE"

git tag -a "$VERSION" -m "Release $VERSION $([ -n "$MESSAGE" ] && echo "$MESSAGE" || echo "")"
git push origin "$VERSION"
git push

echo "Release $VERSION published successfully"
