param(
    [Parameter(Mandatory=$false)]
    [string]$Message = ""
)

# Create and publish release
# Usage: ./release.ps1 [-Message "message"]

git checkout main
git pull origin main

# Read version from apps/package.json and increment last number
$packageJsonPath = "apps/package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version

# Parse and increment version
$versionParts = $currentVersion -split '\.'
$versionParts[-1] = [int]$versionParts[-1] + 1
$VersionNoV = $versionParts -join '.'
$Version = "v$VersionNoV"

# Save incremented version back to apps/package.json
$packageJson.version = $VersionNoV
$packageJson | ConvertTo-Json | Set-Content $packageJsonPath

# Database project release
if (Test-Path "db") {
    Push-Location db
    sql /nolog
    project release -version "v$VersionNoV"
    git add .
    $dbCommitMessage = "db: release $Version $(if ($Message) { $Message })"
    git commit -m $dbCommitMessage
    Pop-Location
}

git add .
$commitMessage = "release: $Version $(if ($Message) { $Message })"
git commit -m $commitMessage

git tag -a "$Version" -m "Release $Version $(if ($Message) { $Message })"
git push origin "$Version"

Write-Output "Release $Version published successfully"
