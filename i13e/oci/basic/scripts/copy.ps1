# copy.ps1 - Copy site files to remote directory
# Usage: .\copy.ps1 ~/.ssh/odbvue opc@79.72.16.185 [remoteDir]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$SshKey,
    
    [Parameter(Mandatory=$true, Position=1)]
    [string]$RemoteHost,
    
    [Parameter(Mandatory=$false, Position=2)]
    [string]$RemoteDir = "~/deploy"
)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SitesYamlPath = Join-Path $ScriptDir "sites.yaml"

# Parse sites.yaml
$sites = @()
$currentSite = @{}

Get-Content $SitesYamlPath | ForEach-Object {
    if ($_ -match '^\s*-\s+siteName:\s*"([^"]+)"') {
        $currentSite = @{ siteName = $matches[1]; localPath = "" }
    }
    elseif ($_ -match '^\s+localPath:\s*"([^"]+)"' -and $currentSite.siteName) {
        $currentSite.localPath = $matches[1]
        $sites += $currentSite
    }
}

# Expand SSH key path
$SshKey = $SshKey -replace '~', $env:USERPROFILE

# Create remote directory first
Write-Host "Creating remote $RemoteDir directory..." -ForegroundColor Cyan
& ssh -i $SshKey $RemoteHost "mkdir -p $RemoteDir"

# Copy all script files to remote (including .ssl folder)
Write-Host "Copying script files..." -ForegroundColor Cyan
& scp -q -i $SshKey -r "$ScriptDir/*" "$RemoteHost`:$RemoteDir/"
& scp -q -i $SshKey -r "$ScriptDir/.ssl" "$RemoteHost`:$RemoteDir/.ssl"
Write-Host "  Script files copied" -ForegroundColor Green

# Copy each site
foreach ($site in $sites) {
    $localPath = $site.localPath
    
    # Expand ~ to home directory
    $localPath = $localPath -replace '^~', $env:USERPROFILE
    
    # Resolve relative paths
    if ($localPath -match '^\.\./') {
        $localPath = Join-Path $ScriptDir $localPath
    }
    
    $localPath = (Resolve-Path $localPath).Path
    
    Write-Host "Copying $($site.siteName)..." -ForegroundColor Cyan
    
    & scp -q -i $SshKey -r "$localPath" "$RemoteHost`:$RemoteDir/$($site.siteName)"
    Write-Host "  Copied" -ForegroundColor Green
}

Write-Host "Done!" -ForegroundColor Green
