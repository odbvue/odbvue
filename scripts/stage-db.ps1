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
project stage 
exit
"@

$sqlScript | sql /nolog

git add .
git commit -m "db stage: $CommitMessage"
Write-Host "Database changes staged and committed: $CommitMessage"
cd ..
