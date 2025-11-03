# Database custom file staging script
# Usage: ./scripts/db-add-custom.ps1 [path-to-file] [commit-message]

param(
    [Parameter(Mandatory=$true)]
    [string]$PathToFile,
    
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

Set-Location db

$sqlCommands = @"
project stage add-custom -file-name $PathToFile
!git add .
!git commit -m "feat(db): $CommitMessage"
exit
"@

$sqlCommands | sql /nolog

Set-Location ..
