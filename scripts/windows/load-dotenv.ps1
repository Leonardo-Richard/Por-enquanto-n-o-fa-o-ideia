<#
.SYNOPSIS
  Carrega variáveis KEY=VALUE de um ficheiro .env.
  Chaves repetidas no mesmo ficheiro: vence a última ocorrência (comportamento típico dotenv).

.PARAMETER OverrideExisting
  Se definido, sobrescreve variáveis já presentes no processo.
  Caso contrário, só define chaves ainda vazias no processo.
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $EnvFilePath,
  [switch] $OverrideExisting
)

if (-not (Test-Path -LiteralPath $EnvFilePath)) {
  return
}

$parsed = [ordered]@{}

Get-Content -LiteralPath $EnvFilePath -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) {
    return
  }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) {
    return
  }
  $key = $line.Substring(0, $eq).Trim()
  $val = $line.Substring($eq + 1).Trim()
  if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
    $val = $val.Substring(1, $val.Length - 2)
  }
  if ($key) {
    $parsed[$key] = $val
  }
}

foreach ($key in $parsed.Keys) {
  $val = [string]$parsed[$key]
  if (-not $OverrideExisting) {
    $cur = [Environment]::GetEnvironmentVariable($key, "Process")
    if (-not [string]::IsNullOrEmpty($cur)) {
      continue
    }
  }
  [Environment]::SetEnvironmentVariable($key, $val, "Process")
}
