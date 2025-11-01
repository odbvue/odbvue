mkdir db
cd db

sql /nolog
project init -name odbvue-db
# Your project has been successfully created
!git add .
!git commit -m "db init project"
project release -version 0.0.0
!git add .
!git commit -m "db init project release"
