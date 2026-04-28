<#
.SYNOPSIS
  Regista uma Tarefa Agendada do Windows para iniciar o worker NFSE portal bridge ao iniciar sessão.

.PARAMETER TaskName
  Nome da tarefa (predefinição: SynkraNFSEPortalBridge).

.PARAMETER Remove
  Remove a tarefa com o nome indicado e sai.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\register-nfse-worker-scheduled-task.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\register-nfse-worker-scheduled-task.ps1 -Remove
#>
param(
  [string] $TaskName = "SynkraNFSEPortalBridge",
  [switch] $Remove
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $here "start-nfse-portal-bridge.ps1"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarefa removida (se existia): $TaskName" -ForegroundColor Green
  exit 0
}

if (-not (Test-Path -LiteralPath $startScript)) {
  Write-Error "Não encontrado: $startScript"
}

$arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
# Ao iniciar sessão do utilizador actual (melhor para certificado e pastas de utilizador)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null
} catch {
  # Fallback sem elevation explícita
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
}

Write-Host "Tarefa registada: $TaskName" -ForegroundColor Green
Write-Host "  Accção: powershell.exe $arg" -ForegroundColor Gray
Write-Host "  Gatilho: ao iniciar sessão ($env:USERNAME)" -ForegroundColor Gray
Write-Host ""
Write-Host "Para testar agora: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
Write-Host "Para remover: powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Remove" -ForegroundColor Cyan
