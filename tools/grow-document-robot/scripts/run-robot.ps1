param(
  [switch]$CheckOnly
)

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

  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($config.robotUserPasswordProtected) {
    $securePassword = ConvertTo-SecureString $config.robotUserPasswordProtected
    $credential = New-Object System.Management.Automation.PSCredential($config.robotUserEmail, $securePassword)
    $env:GROW_ROBOT_PASSWORD = $credential.GetNetworkCredential().Password
  }

  if (-not $env:GROW_ROBOT_PASSWORD -and -not $config.robotUserPassword) {
    throw "Credencial do robo ausente. Execute 'npm.cmd run robot:setup'."
  }

  if ($CheckOnly) {
    & node $distPath $configPath --check
    if ($LASTEXITCODE -ne 0) { throw "A validacao do robo falhou." }
  } else {
    "[$(Get-Date -Format o)] Starting Grow Document Robot" | Tee-Object -FilePath $logPath -Append
    & node $distPath $configPath 2>&1 | Tee-Object -FilePath $logPath -Append
  }
}
finally {
  Remove-Item Env:GROW_ROBOT_PASSWORD -ErrorAction SilentlyContinue
  Pop-Location
}
