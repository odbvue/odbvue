param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Connection,
    [Parameter(Position=1, Mandatory=$true)]
    [string]$CommitMessage)

# Stage database changes
cd db
git add .
git commit -m "db: $CommitMessage"

$sqlScript = @"
connect $Connection
project export
!git add .
!git commit -m "db export: $CommitMessage"
project stage 
!git add .
!git commit -m "db stage: $CommitMessage"
exit
"@

$sqlScript | sql /nolog

Write-Host "Database changes exported, staged and committed: $CommitMessage"
cd ..
