param(
    [Parameter(Mandatory=$false)]
    [string]$Message = ""
)

# Create and publish release
# Usage: ./release.ps1 [-Message "message"]

git checkout main
git pull origin main

# Read version from apps/package.json
# (version is already bumped by GitHub Actions changeset workflow)
$packageJsonPath = "apps/package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$VersionNoV = $packageJson.version
$Version = "v$VersionNoV"

# Database project release
if (Test-Path "db") {
    cd db
    @"
project release -version "v$VersionNoV"
exit
"@ | sql /nolog
    cd ..
}

git add .
$commitMessage = "release: $Version $(if ($Message) { $Message })"
git commit -m $commitMessage

git tag -a "$Version" -m "Release $Version $(if ($Message) { $Message })"
git push origin "$Version"
git push

Write-Output "Release $Version published successfully"
