#!/usr/bin/env pwsh
param(
    [string]$Profile = "DEFAULT",
    [switch]$Quiet
)

# Check prerequisites
if (-not (Get-Command podman -ErrorAction SilentlyContinue)) { 
    Write-Host "Error: Podman is not installed" -ForegroundColor Red
    exit 1 
}

$ociDir = Join-Path $HOME ".oci"
if (-not (Test-Path $ociDir) -or -not (Test-Path (Join-Path $ociDir "config"))) { 
    Write-Host "Error: OCI config not found at $ociDir" -ForegroundColor Red
    exit 1 
}

# Build image if needed and run
$imageName = "oci-cli:latest"
if (-not (podman images --format "{{.Repository}}:{{.Tag}}" | Select-String -Pattern "^oci-cli:latest$")) {
    if (-not $Quiet) { Write-Host "Building OCI CLI image..." -ForegroundColor Yellow }
    podman build -t $imageName . 2>&1 | Out-Null
}

$quietParam = if ($Quiet) { "true" } else { "false" }
podman run --rm -v "${ociDir}:/root/.oci:ro" $imageName $Profile $quietParam

