<#
.SYNOPSIS
  Inicia o worker ADN (nfse-portal-bridge) com variáveis do .env na raiz do repositório.

.NOTAS
  - Use workers/nfse-portal-bridge/.venv se existir; senão `python` no PATH.
  - Registo opcional em workers/nfse-portal-bridge/logs/worker-YYYYMMDD.log
#>
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $here)
$bridgeDir = Join-Path $repoRoot "workers\nfse-portal-bridge"
$loadDotenv = Join-Path $here "load-dotenv.ps1"

$envMain = Join-Path $repoRoot ".env"
$envLocal = Join-Path $repoRoot ".env.local"
if (Test-Path -LiteralPath $envMain) {
  . $loadDotenv -EnvFilePath $envMain
}
if (Test-Path -LiteralPath $envLocal) {
  . $loadDotenv -EnvFilePath $envLocal -OverrideExisting
}

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL não definido. Configure em .env na raiz do repositório."
}

if (-not $env:ADN_WORKER_HMAC_SECRET) {
  Write-Error "ADN_WORKER_HMAC_SECRET não definido. Configure em .env na raiz do repositório."
}

$portal = $env:API_INTERNAL_URL
if ([string]::IsNullOrWhiteSpace($portal)) {
  $portal = $env:PORTAL_INTERNAL_URL
}
if ([string]::IsNullOrWhiteSpace($portal)) {
  $portal = "http://localhost:3000"
  [Environment]::SetEnvironmentVariable("PORTAL_INTERNAL_URL", $portal, "Process")
  Write-Host "[nfse-portal-bridge] PORTAL_INTERNAL_URL não definido; a usar $portal" -ForegroundColor DarkYellow
}

$venvPy = Join-Path $bridgeDir ".venv\Scripts\python.exe"
$pythonExe = if (Test-Path -LiteralPath $venvPy) { $venvPy } else { "python" }

$logDir = Join-Path $bridgeDir "logs"
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir ("worker-{0:yyyyMMdd}.log" -f (Get-Date))

$script = Join-Path $bridgeDir "poll_jobs.py"
Write-Host "[nfse-portal-bridge] Python: $pythonExe" -ForegroundColor Cyan
Write-Host "[nfse-portal-bridge] Script: $script" -ForegroundColor Cyan
Write-Host "[nfse-portal-bridge] Log: $logFile" -ForegroundColor Cyan

# Append stdout/stderr ao ficheiro de log e espelha na consola
& $pythonExe $script *>&1 | Tee-Object -FilePath $logFile -Append
