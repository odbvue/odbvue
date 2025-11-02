#!/bin/bash

# Check if required parameters are provided
if [ $# -lt 2 ]; then
    echo "Usage: ./db-export.sh <Connection> <CommitMessage>"
    exit 1
fi

CONNECTION=$1
COMMIT_MESSAGE=$2

# Stage database changes
cd db
git add .
git commit -m "db: $COMMIT_MESSAGE"

# Create SQL script and execute it
sql /nolog <<EOF
connect $CONNECTION
project export
!git add .
!git commit -m "db export: $COMMIT_MESSAGE"
project stage 
!git add .
!git commit -m "db stage: $COMMIT_MESSAGE"
exit
EOF

echo "Database changes exported, staged and committed: $COMMIT_MESSAGE"
cd ..
