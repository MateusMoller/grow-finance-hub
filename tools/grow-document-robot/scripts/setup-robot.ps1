$ErrorActionPreference = "Stop"

function Read-EnvValue {
  param([string[]]$Files, [string[]]$Names)

  foreach ($file in $Files) {
    if (-not (Test-Path -LiteralPath $file)) { continue }
    foreach ($line in Get-Content -LiteralPath $file) {
      foreach ($name in $Names) {
        if ($line -match "^\s*$([regex]::Escape($name))\s*=\s*(.+?)\s*$") {
          return $Matches[1].Trim().Trim('"').Trim("'")
        }
      }
    }
  }
  return $null
}

function Read-WithDefault {
  param([string]$Prompt, [string]$Default)
  $value = Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$robotRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent (Split-Path -Parent $robotRoot)
$runtimeDir = Join-Path $robotRoot "runtime"
$configPath = Join-Path $runtimeDir "config.local.json"
$runScript = Join-Path $scriptDir "run-robot.ps1"
$installScript = Join-Path $scriptDir "install-windows-task.ps1"
$envFiles = @(
  (Join-Path $projectRoot ".env.local"),
  (Join-Path $projectRoot ".env.development"),
  (Join-Path $projectRoot ".env")
)

Write-Host ""
Write-Host "=== Instalacao do Robo de Documentos Grow ===" -ForegroundColor Cyan
Write-Host "Informe apenas a pasta monitorada e o login do robo."
Write-Host ""

$supabaseUrl = Read-EnvValue -Files $envFiles -Names @("VITE_SUPABASE_URL", "SUPABASE_URL")
$supabaseKey = Read-EnvValue -Files $envFiles -Names @("VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")
if (-not $supabaseUrl -or -not $supabaseKey) {
  throw "URL ou chave publica do Supabase nao encontrada nos arquivos .env do projeto."
}

$folder = Read-WithDefault -Prompt "Pasta que o robo deve monitorar" -Default "C:\Grow\Entrada-eContinuo"
$email = Read-Host "E-mail do usuario do robo"
if ([string]::IsNullOrWhiteSpace($email)) { throw "O e-mail do robo e obrigatorio." }
$password = Read-Host "Senha do usuario do robo" -AsSecureString
$passwordProtected = ConvertFrom-SecureString $password
$machineId = Read-WithDefault -Prompt "Identificacao deste computador" -Default "grow-robot-$($env:COMPUTERNAME.ToLowerInvariant())"

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
New-Item -ItemType Directory -Path $folder -Force | Out-Null

$config = [ordered]@{
  supabaseUrl = $supabaseUrl
  supabaseAnonKey = $supabaseKey
  robotUserEmail = $email.Trim()
  robotUserPasswordProtected = $passwordProtected
  machineId = $machineId
  stateFile = "./state.json"
  scanIntervalMs = 30000
  retryDelayMs = 120000
  maxRetries = 5
  folders = @($folder)
}
$config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

Push-Location $projectRoot
try {
  Write-Host "Compilando o robo..." -ForegroundColor Cyan
  & npm.cmd run build:robot
  if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o robo." }

  Write-Host "Validando conexao e credenciais..." -ForegroundColor Cyan
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runScript -CheckOnly
  if ($LASTEXITCODE -ne 0) { throw "Credenciais invalidas ou conexao indisponivel." }

  Write-Host "Instalando inicializacao automatica..." -ForegroundColor Cyan
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScript
  if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar a tarefa automatica." }
}
finally {
  Pop-Location
}

Start-Sleep -Seconds 2
$task = Get-ScheduledTask -TaskName "Grow Document Robot" -ErrorAction Stop
Write-Host ""
Write-Host "Robo instalado com sucesso." -ForegroundColor Green
Write-Host "Pasta monitorada: $folder"
Write-Host "Status da inicializacao: $($task.State)"
Write-Host "Agora basta colocar PDFs nessa pasta."
