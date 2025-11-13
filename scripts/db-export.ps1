param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$CommitMessage,
    [Parameter(Position=1, Mandatory=$false)]
    [string]$Connection
)

# Try to get connection from environment variable if not provided
if ([string]::IsNullOrWhiteSpace($Connection)) {
    $Connection = $env:ODBVUE_DB_DEV
}

if ([string]::IsNullOrWhiteSpace($Connection)) {
    Write-Host "Error: Connection not provided and ODBVUE_DB_DEV environment variable not set." -ForegroundColor Red
    Write-Host "Usage: .\db-export.ps1 <CommitMessage> [Connection]" -ForegroundColor Red
    exit 1
}

Set-Location db

$sqlScript = @"
connect $Connection
project export
exit
"@

$sqlScript | sql /nolog

Write-Host "Please check if DB objects are correctly exported" -ForegroundColor Yellow
$confirmation = Read-Host "Confirm to commit changes? (y/Y to confirm)"

if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Export aborted." -ForegroundColor Red
    Set-Location ..
    exit 1
}

git add .
git commit -m "feat(db): $CommitMessage"

Set-Location ..
