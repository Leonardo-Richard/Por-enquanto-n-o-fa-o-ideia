# Termina processos node/python do worker ADN (run-adn-bridge-watch / poll_jobs.py).
$ErrorActionPreference = "SilentlyContinue"
$killed = New-Object System.Collections.ArrayList
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -match "^(node|python)\.exe$" -and $_.CommandLine } |
    ForEach-Object {
        $cl = $_.CommandLine
        if ($cl -match "run-adn-bridge-watch|poll_jobs\.py") {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            [void]$killed.Add($_.ProcessId)
        }
    }
if ($killed.Count -gt 0) {
    Write-Host ("Parados PIDs: " + ($killed -join ", "))
} else {
    Write-Host "Nenhum processo worker ADN encontrado."
}
