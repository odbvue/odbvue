#Requires -Version 5.0

# Wrapper for changeset workflow
# Usage: .\create-pr.ps1
# You'll be prompted to:
# - Select which packages changed (usually main app)
# - Choose version bump: patch, minor, or major
# - Write a concise summary

# Check for uncommitted changes
$status = git status -s
if ($status) {
  Write-Host "Error: You have uncommitted changes. Please commit or stash them first." -ForegroundColor Red
  Write-Host $status
  exit 1
}

param(
    [Parameter(Position=0, Mandatory=$false)]
    [string]$Connection
)

# Try to get connection from environment variable if not provided
if ([string]::IsNullOrWhiteSpace($Connection)) {
    $Connection = $env:ODBVUE_DB_DEV
}

if ([string]::IsNullOrWhiteSpace($Connection)) {
    Write-Host "Error: Connection not provided and ODBVUE_DB_DEV environment variable not set." -ForegroundColor Red
    Write-Host "Usage: .\submit-pr.ps1 [Connection]" -ForegroundColor Red
    exit 1
}

Push-Location db

$sqlScript = @"
connect $Connection
project stage 
exit
"@

$sqlScript | sql /nolog

Pop-Location

Push-Location apps
pnpm changeset

# Commit the changeset
git add .
$summary = Get-Content (Get-ChildItem .changeset/*.md -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1) | Select-Object -Last 1
git commit -m "changeset: $summary"
Write-Host "Changeset created and committed." -ForegroundColor Green

# Push to remote
$branch = git rev-parse --abbrev-ref HEAD
git push -u origin $branch
Write-Host "Pushed to origin/$branch" -ForegroundColor Green

Pop-Location
