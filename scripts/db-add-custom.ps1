# Database custom file staging script
# Usage: ./scripts/db-add-custom.ps1 [path-to-file]

param(
    [Parameter(Mandatory=$true)]
    [string]$PathToFile
)

Set-Location db

$sqlCommands = @"
project stage add-custom -file-name $PathToFile
exit
"@

$sqlCommands | sql /nolog

Set-Location ..
