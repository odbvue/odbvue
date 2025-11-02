param(
    [Parameter(Mandatory=$true)]
    [string]$FeatureName
)

# Close feature branch
# Usage: ./close-feature.ps1 -FeatureName [feature-name]

git checkout main
git pull origin main
git merge --squash feat/$FeatureName
git push
git branch -d feat/$FeatureName
git push origin --delete feat/$FeatureName
Write-Output "Feature closed"
