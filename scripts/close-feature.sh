#!/bin/bash

# Close feature branch
# Usage: ./close-feature.sh

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Safety check: exit if on main
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "Error: Already on main branch"
    exit 1
fi

git checkout main
git pull origin main
git merge --squash $CURRENT_BRANCH
git push
git branch -d $CURRENT_BRANCH
git push origin --delete $CURRENT_BRANCH
echo "Feature closed"
