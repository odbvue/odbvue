param([string]$FeatureName)

if (-not $FeatureName) {
    Write-Host "Usage: ./begin-new-feature.ps1 [feature-name]"
    exit 1
}

# Check for unmerged changes
$status = git status --porcelain
if ($status) {
    Write-Host "Error: You have unmerged changes. Please commit or stash them before proceeding."
    exit 1
}

git checkout main
git pull origin main
git checkout -b "feat/$FeatureName"

Write-Host "Feature branch 'feat/$FeatureName' created and checked out."