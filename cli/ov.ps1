param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistPath = Join-Path -Path $ScriptDir -ChildPath "dist" | Join-Path -ChildPath "index.js"

node $DistPath @Arguments
