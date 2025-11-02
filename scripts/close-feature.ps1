# Close feature branch
# Usage: ./close-feature.ps1

# Get current branch name
$CurrentBranch = git rev-parse --abbrev-ref HEAD

# Safety check: exit if on main
if ($CurrentBranch -eq "main") {
    Write-Output "Error: Already on main branch"
    exit 1
}

git checkout main
git pull origin main
git merge --squash $CurrentBranch
git push
git branch -d $CurrentBranch
git push origin --delete $CurrentBranch
Write-Output "Feature closed"
