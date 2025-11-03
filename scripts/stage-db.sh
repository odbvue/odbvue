#!/bin/bash

# Stage database changes
connection="${1}"
commit_message="${2}"

cd db
git add .
git commit -m "db: ${commit_message}"
sql /nolog << EOF
connect ${connection}
project stage 
exit
EOF
git add .
git commit -m "db stage: ${commit_message}"
echo "Database changes staged and committed: ${commit_message}"
cd ..
