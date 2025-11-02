#Requires -Version 5.0

# Wrapper for changeset workflow
# Usage: .\create-changeset.ps1
# You'll be prompted to:
# - Select which packages changed (usually main app)
# - Choose version bump: patch, minor, or major
# - Write a concise summary

Push-Location apps
pnpm changeset

# Commit the changeset
git add .
$summary = Get-Content (Get-ChildItem .changeset/*.md -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1) | Select-Object -Last 1
git commit -m "changeset: $summary"
Write-Host "✅ Changeset created and committed." -ForegroundColor Green

Pop-Location
