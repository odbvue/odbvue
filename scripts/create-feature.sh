#!/bin/bash

# Begin a new feature branch with the specified feature name
# Usage: ./begin-new-feature.sh [feature-name]

if [ -z "$1" ]; then
  echo "Usage: ./begin-new-feature.sh [feature-name]"
  exit 1
fi

FEATURE_NAME=$1

git checkout main
git pull origin main
git checkout -b feat/$FEATURE_NAME

echo "Feature branch 'feat/$FEATURE_NAME' created and checked out."
