param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$ReleaseName
)

# Exit on any error
$ErrorActionPreference = "Stop"

Write-Host "Starting release process for v$Version - $ReleaseName"
Write-Host ""

# Checkout main and pull latest changes
Write-Host "Checking out main branch..."
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
git push origin v$Version

Write-Host ""
Write-Host "Release v$Version ($ReleaseName) completed successfully!"
