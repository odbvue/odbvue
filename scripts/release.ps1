param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$Message
)

# Create and publish release
# Usage: ./release.ps1 -Version [version] -Message [message]

git checkout main
git pull origin main

# Bump version in package.json files (remove v prefix if present)
$VersionNoV = $Version -replace '^v', ''

# Update package.json in apps directory
if (Test-Path "apps/package.json") {
    $packageJson = Get-Content "apps/package.json" -Raw | ConvertFrom-Json
    $packageJson.version = $VersionNoV
    $packageJson | ConvertTo-Json | Set-Content "apps/package.json"
}

# Database project release
if (Test-Path "db") {
    Push-Location db
    sql /nolog
    project release -version "v$VersionNoV"
    git add .
    git commit -m "db: release $Version $Message"
    Pop-Location
}

git add .
git commit -m "release: $Version $Message"

git tag -a "$Version" -m "Release $Version $Message"
git push origin "$Version"

Write-Output "Release $Version published successfully"
