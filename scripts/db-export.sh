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
exit
EOF

echo "Please check if DB objects are correctly exported"
read -p "Confirm to commit changes? (y/Y to confirm): " confirmation

if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
    echo "Export aborted."
    cd ..
    exit 1
fi

git add .
git commit -m "feat(db): $COMMIT_MESSAGE"

cd ..
