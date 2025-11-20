#!/bin/bash

# Database custom file staging script
# Usage: ./scripts/db-add-custom.sh [path-to-file]

if [ $# -lt 1 ]; then
    echo "Usage: $0 [path-to-file]"
    exit 1
fi

PATH_TO_FILE="$1"

cd db

sql /nolog <<EOF
project stage add-custom -file-name $PATH_TO_FILE
exit
EOF

cd ..
