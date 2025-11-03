param([string]$FeatureName)

if (-not $FeatureName) {
    Write-Host "Usage: ./begin-new-feature.ps1 [feature-name]"
    exit 1
}

git checkout main
git pull origin main
git checkout -b "feat/$FeatureName"

Write-Host "Feature branch 'feat/$FeatureName' created and checked out."