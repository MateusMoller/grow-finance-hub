@echo off
setlocal
title Instalador do Robo de Documentos Grow
set "GROW_INSTALLER_FILE=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$content = Get-Content -LiteralPath $env:GROW_INSTALLER_FILE -Raw; $marker = '# GROW_POWERSHELL_INSTALLER'; $start = $content.LastIndexOf($marker); if ($start -lt 0) { throw 'Conteudo do instalador nao encontrado.' }; $script = $content.Substring($start + $marker.Length); & ([scriptblock]::Create($script))"
set "GROW_EXIT_CODE=%ERRORLEVEL%"
exit /b %GROW_EXIT_CODE%

# GROW_POWERSHELL_INSTALLER
$ErrorActionPreference = "Stop"

$repositoryArchive = "https://github.com/MateusMoller/grow-finance-hub/archive/refs/heads/main.zip"
$installationRoot = Join-Path $env:LOCALAPPDATA "Grow\DocumentRobot"
$versionName = "source-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$versionPath = Join-Path $installationRoot $versionName
$downloadPath = Join-Path $env:TEMP "grow-document-robot-$([guid]::NewGuid().ToString('N')).zip"
$extractPath = Join-Path $env:TEMP "grow-document-robot-$([guid]::NewGuid().ToString('N'))"

function Assert-Command {
  param([string]$Name, [string]$InstallMessage)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name nao foi encontrado. $InstallMessage"
  }
}

try {
  Write-Host ""
  Write-Host "=== Instalador do Robo de Documentos Grow ===" -ForegroundColor Cyan
  Write-Host "Preparando os arquivos necessarios..."

  Assert-Command -Name "node.exe" -InstallMessage "Instale o Node.js 22 ou superior e execute este instalador novamente."
  Assert-Command -Name "npm.cmd" -InstallMessage "Reinstale o Node.js com o npm habilitado."

  $nodeVersionText = (& node.exe --version).TrimStart("v")
  $nodeMajorVersion = [int]($nodeVersionText.Split(".")[0])
  if ($nodeMajorVersion -lt 22) {
    throw "O robo requer Node.js 22 ou superior. Versao encontrada: $nodeVersionText."
  }

  New-Item -ItemType Directory -Path $installationRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

  Invoke-WebRequest -Uri $repositoryArchive -OutFile $downloadPath -UseBasicParsing
  Expand-Archive -LiteralPath $downloadPath -DestinationPath $extractPath -Force
  $sourcePath = Get-ChildItem -LiteralPath $extractPath -Directory | Select-Object -First 1
  if (-not $sourcePath) { throw "O pacote baixado nao contem os arquivos esperados." }
  Move-Item -LiteralPath $sourcePath.FullName -Destination $versionPath

  Push-Location $versionPath
  try {
    Write-Host "Instalando dependencias do robo..." -ForegroundColor Cyan
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as dependencias do robo." }

    $robotSourcePath = Join-Path $versionPath "tools\grow-document-robot\src\index.ts"
    $robotSource = Get-Content -LiteralPath $robotSourcePath -Raw
    $robotSource = $robotSource.Replace('text_extraction_status: normalizedText ? "extracted" : "empty"', 'text_extraction_status: normalizedText ? "completed" : "failed"')
    $robotSource = $robotSource.Replace('ocr_status: normalizedText ? "not_needed" : "not_available"', 'ocr_status: normalizedText ? "not_needed" : "failed"')
    $robotSource = $robotSource.Replace('ocr_status: "not_available"', 'ocr_status: "failed"')
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($robotSourcePath, $robotSource, $utf8WithoutBom)

    Write-Host "Compilando o robo..." -ForegroundColor Cyan
    & npm.cmd run build:robot
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o robo." }

    $runtimeConfigPath = Join-Path $versionPath "public\runtime-config.js"
    $runtimeConfig = Get-Content -LiteralPath $runtimeConfigPath -Raw
    $supabaseUrlMatch = [regex]::Match($runtimeConfig, 'VITE_SUPABASE_URL\s*:\s*"([^"]+)"')
    $supabaseKeyMatch = [regex]::Match($runtimeConfig, 'VITE_SUPABASE_PUBLISHABLE_KEY\s*:\s*"([^"]+)"')
    if (-not $supabaseUrlMatch.Success -or -not $supabaseKeyMatch.Success) {
      throw "A configuracao publica de conexao nao foi encontrada no pacote."
    }

    $defaultFolder = "C:\Grow\Entrada-eContinuo"
    $folder = Read-Host "Pasta monitorada [$defaultFolder]"
    if ([string]::IsNullOrWhiteSpace($folder)) { $folder = $defaultFolder }
    $email = Read-Host "E-mail do usuario do robo"
    if ([string]::IsNullOrWhiteSpace($email)) { throw "O e-mail do robo e obrigatorio." }
    $password = Read-Host "Senha do usuario do robo" -AsSecureString
    $passwordProtected = ConvertFrom-SecureString $password

    $runtimeDir = Join-Path $versionPath "tools\grow-document-robot\runtime"
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $robotConfigPath = Join-Path $runtimeDir "config.local.json"
    $robotConfig = [ordered]@{
      supabaseUrl = $supabaseUrlMatch.Groups[1].Value
      supabaseAnonKey = $supabaseKeyMatch.Groups[1].Value
      robotUserEmail = $email.Trim()
      robotUserPasswordProtected = $passwordProtected
      machineId = "grow-robot-$($env:COMPUTERNAME.ToLowerInvariant())"
      stateFile = "./state.json"
      scanIntervalMs = 30000
      retryDelayMs = 120000
      maxRetries = 5
      folders = @($folder)
    }
    $robotConfig | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $robotConfigPath -Encoding UTF8

    $runnerPath = Join-Path $versionPath "run-installed-robot.ps1"
    $runnerScript = @'
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$robotRoot = Join-Path $projectRoot "tools\grow-document-robot"
$configPath = Join-Path $robotRoot "runtime\config.local.json"
$distPath = Join-Path $robotRoot "dist\index.js"
$logDir = Join-Path $robotRoot "runtime"
$outLog = Join-Path $logDir "robot-run.log"
$errorLog = Join-Path $logDir "robot-error.log"
$sessionConfigPath = Join-Path $logDir "config.session.$PID.json"

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$securePassword = ConvertTo-SecureString $config.robotUserPasswordProtected
$credential = New-Object System.Management.Automation.PSCredential($config.robotUserEmail, $securePassword)
$config | Add-Member -NotePropertyName robotUserPassword -NotePropertyValue $credential.GetNetworkCredential().Password -Force
$config.PSObject.Properties.Remove("robotUserPasswordProtected")
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sessionConfigPath, ($config | ConvertTo-Json -Depth 5), $utf8WithoutBom)

try {
  $arguments = @("`"$distPath`"", "`"$sessionConfigPath`"")
  $robotProcess = Start-Process -FilePath "node.exe" -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errorLog -PassThru
  Start-Sleep -Seconds 4
  if ($robotProcess.HasExited) {
    $details = if (Test-Path $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { "Sem detalhes adicionais." }
    throw "O robo encerrou durante a inicializacao. $details"
  }
}
finally {
  Remove-Item -LiteralPath $sessionConfigPath -Force -ErrorAction SilentlyContinue
}
'@
    Set-Content -LiteralPath $runnerPath -Value $runnerScript -Encoding UTF8

    $taskName = "Grow Document Robot"
    $currentUser = "$env:USERDOMAIN\$env:USERNAME"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Inicia o robo local de documentos da Grow no logon do Windows." | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 6

    $robotProcesses = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$distPath*" }
    if (-not $robotProcesses) {
      $errorLog = Join-Path $runtimeDir "robot-error.log"
      $details = if (Test-Path $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { "Consulte a tarefa '$taskName'." }
      throw "O robo nao permaneceu em execucao. $details"
    }
  }
  finally {
    Pop-Location
  }
}
catch {
  Write-Host ""
  Write-Host "Nao foi possivel instalar o robo:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Read-Host "Pressione Enter para fechar"
  exit 1
}
finally {
  Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Instalacao concluida. O robo ja esta monitorando a pasta escolhida." -ForegroundColor Green
Read-Host "Pressione Enter para fechar"
