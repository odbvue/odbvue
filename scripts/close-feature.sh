#!/bin/bash

# Close feature branch
# Usage: ./close-feature.sh [feature-name]

if [ -z "$1" ]; then
    echo "Error: feature name is required"
    echo "Usage: ./close-feature.sh [feature-name]"
    exit 1
fi

FEATURE_NAME=$1

git checkout main
git pull origin main
git merge --squash feat/$FEATURE_NAME
git push
git branch -d feat/$FEATURE_NAME
git push origin --delete feat/$FEATURE_NAME
echo "Feature closed"
