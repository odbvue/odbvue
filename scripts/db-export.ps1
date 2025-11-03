param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Connection,
    [Parameter(Position=1, Mandatory=$true)]
    [string]$CommitMessage)

$sqlScript = @"
connect $Connection
project export
!git add .
!git commit -m "db export: $CommitMessage"
exit
"@

$sqlScript | sql /nolog

Write-Host "Database changes exported and committed: $CommitMessage"
cd ..
