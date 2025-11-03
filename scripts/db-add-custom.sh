#!/bin/bash

# Database custom file staging script
# Usage: ./scripts/db-add-custom.sh [path-to-file] [commit-message]

if [ $# -lt 2 ]; then
    echo "Usage: $0 [path-to-file] [commit-message]"
    exit 1
fi

PATH_TO_FILE="$1"
COMMIT_MESSAGE="$2"

cd db

sql /nolog <<EOF
project stage add-custom -file-name $PATH_TO_FILE
!git add .
!git commit -m "feat(db): $COMMIT_MESSAGE"
exit
EOF

cd ..
