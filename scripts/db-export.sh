#!/bin/bash

# Check if required parameters are provided
if [ $# -lt 1 ]; then
    echo "Usage: ./db-export.sh <CommitMessage> [Connection]"
    exit 1
fi

COMMIT_MESSAGE=$1
CONNECTION=${2:-$ODBVUE_DB_DEV}

if [ -z "$CONNECTION" ]; then
    echo "Error: Connection not provided and ODBVUE_DB_DEV environment variable not set."
    echo "Usage: ./db-export.sh <CommitMessage> [Connection]"
    exit 1
fi

cd db

sql /nolog <<EOF
connect $CONNECTION
project export
!git add .
!git commit -m "feat(db): $COMMIT_MESSAGE"
exit
EOF

cd ..
