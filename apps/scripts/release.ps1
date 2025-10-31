param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$ReleaseName
)

# Exit on any error
$ErrorActionPreference = "Stop"

# Determine repo root directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

Write-Host "Starting release process for v$Version - $ReleaseName"
Write-Host ""

# Create DB Release
Write-Host "Generating database artifact..."
Set-Location "$repoRoot\db"

$sqlScript = @"
project release -version v$Version
project gen-artifact -version v$Version
exit
"@

$sqlScript | sql /nolog

Write-Host "Staging database changes..."
Set-Location $repoRoot
git add db/
git commit -m "chore(db-release): v$Version" -ErrorAction SilentlyContinue | Out-Null

Write-Host "Pushing database changes..."
git push

# Checkout main and pull latest changes
Write-Host "Checking out main branch..."
Set-Location $repoRoot
git checkout main

Write-Host "Pulling latest changes..."
git pull

# Create release branch
Write-Host "Creating release branch release/$Version..."
git checkout -b release/$Version

# Stage package.json
Write-Host "Staging apps/package.json..."
git add apps/package.json

# Commit changes
Write-Host "Committing changes..."
git commit -m "chore(release): v$Version"

# Push release branch
Write-Host "Pushing release branch to origin..."
git push -u origin release/$Version

# Checkout main again
Write-Host "Checking out main branch..."
git checkout main

# Pull latest changes
Write-Host "Pulling latest changes..."
git pull

# Create and push tag
Write-Host "Creating tag v$Version..."
git tag -a v$Version -m "Release v$Version - $ReleaseName"

Write-Host "Pushing tag to origin..."
git push origin main
git push origin v$Version

Write-Host ""
Write-Host "Release process for v$Version - $ReleaseName completed successfully."
