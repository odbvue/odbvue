param(
    [string]$Path = ".env"
)

# Get the scripts directory
$scriptDir = $PSScriptRoot

# Try to find .env: first in scripts directory, then parent directory
$envInScripts = Join-Path -Path $scriptDir -ChildPath $Path
$envInParent = Join-Path -Path (Join-Path -Path $scriptDir -ChildPath "..") -ChildPath $Path

if (Test-Path $envInScripts) {
    $Path = (Resolve-Path $envInScripts).Path
}
elseif (Test-Path $envInParent) {
    $Path = (Resolve-Path $envInParent).Path
}
else {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    exit 1
}

Write-Host "Loading .env from: $Path" -ForegroundColor Green

Get-Content $Path | ForEach-Object {
    # Skip empty lines and comments
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"', "'")
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        Write-Host "  v $key" -ForegroundColor Gray
    }
}

Write-Host "Environment loaded successfully" -ForegroundColor Green
