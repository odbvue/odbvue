param(
    [Parameter(Mandatory=$false)]
    [string]$ReleaseName
)

# Exit on any error
$ErrorActionPreference = "Stop"

# Determine repo root directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

# Checkout main and pull latest changes first
Write-Host "Checking out main branch..."
Set-Location $repoRoot
git checkout main

Write-Host "Pulling latest changes..."
git pull
Write-Host ""

# Increment version in package.json
Write-Host "Incrementing version in package.json..."
Set-Location "$repoRoot/apps"
$packageJsonPath = "package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$versionParts = $packageJson.version -split '\.'
[int]$versionParts[-1]++
$packageJson.version = $versionParts -join '.'
$packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath
Write-Host "Version updated to $($packageJson.version)"
Write-Host ""

# Build the application
# Write-Host "Building application..."
# Set-Location "$repoRoot/apps"
# pnpm build
# pnpm wiki:build

# Extract version from package.json
$packageJson = Get-Content package.json -Raw | ConvertFrom-Json
$VERSION = $packageJson.version

if ([string]::IsNullOrEmpty($VERSION)) {
    Write-Error "Error: Could not extract version from package.json"
    exit 1
}

# Build release message
if ([string]::IsNullOrEmpty($ReleaseName)) {
    $RELEASE_MSG = "v$VERSION"
    Write-Host "Starting release process for v$VERSION"
} else {
    $RELEASE_MSG = "v$VERSION - $ReleaseName"
    Write-Host "Starting release process for v$VERSION - $ReleaseName"
}
Write-Host ""

# Create DB Release
Write-Host "Generating database artifact..."
Set-Location "$repoRoot/db"

$sqlScript = @"
project release -version v$VERSION
project gen-artifact -version v$VERSION
exit
"@

$sqlScript | sql /nolog

Write-Host "Staging database changes..."
Set-Location $repoRoot
git add db/
git commit -m "chore(db-release): v$VERSION" -ErrorAction SilentlyContinue | Out-Null

Write-Host "Pushing database changes..."
git push

# Create release branch
Write-Host "Creating release branch release/$VERSION..."
git checkout -b release/$VERSION

# Stage package.json
Write-Host "Staging apps/package.json..."
git add apps/package.json

# Commit changes
Write-Host "Committing changes..."
git commit -m "chore(release): v$VERSION"

# Push release branch
Write-Host "Pushing release branch to origin..."
git push -u origin release/$VERSION

# Pull latest from main (in case of concurrent changes)
Write-Host "Pulling latest changes from main..."
Set-Location $repoRoot
git checkout main
git pull

# Create and push tag
Write-Host "Creating tag v$VERSION..."
git tag -a v$VERSION -m "Release $RELEASE_MSG"

Write-Host "Pushing tag to origin..."
git push origin main
git push origin v$VERSION

Write-Host ""
Write-Host "Release process for $RELEASE_MSG completed successfully."
