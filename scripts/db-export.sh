#!/bin/bash

# Check if required parameters are provided
if [ $# -lt 2 ]; then
    echo "Usage: ./db-export.sh <Connection> <CommitMessage>"
    exit 1
fi

CONNECTION=$1
COMMIT_MESSAGE=$2

# Create SQL script and execute it
sql /nolog <<EOF
connect $CONNECTION
project export
!git add .
!git commit -m "db export: $COMMIT_MESSAGE"
exit
EOF

echo "Database changes exported and committed: $COMMIT_MESSAGE"
cd ..
