$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$robotRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent (Split-Path -Parent $robotRoot)
$configPath = Join-Path $robotRoot "runtime\config.local.json"
$distPath = Join-Path $robotRoot "dist\index.js"
$logDir = Join-Path $robotRoot "runtime"
$logPath = Join-Path $logDir "robot-run.log"

New-Item -ItemType Directory -Force $logDir | Out-Null

Push-Location $projectRoot
try {
  if (-not (Test-Path $distPath)) {
    & npm.cmd run build:robot | Tee-Object -FilePath $logPath -Append
  }

  "[$(Get-Date -Format o)] Starting Grow Document Robot" | Tee-Object -FilePath $logPath -Append
  & node $distPath $configPath 2>&1 | Tee-Object -FilePath $logPath -Append
}
finally {
  Pop-Location
}
