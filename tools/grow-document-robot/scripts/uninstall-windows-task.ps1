$ErrorActionPreference = "Stop"

$taskName = "Grow Document Robot"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop | Out-Null
Write-Host "Tarefa '$taskName' removida com sucesso."
