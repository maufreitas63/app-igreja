# Sobe o Expo web na porta 8081 se ainda nao estiver escutando.
# Usado pela tarefa automatica do Cursor (ao abrir a pasta).
param(
  [int] $Port = 8081
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Test-PortListening([int] $TargetPort) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    return [bool]($connections | Select-Object -First 1)
  } catch {
    $netstat = netstat -ano | Select-String ":$TargetPort\s"
    return [bool]($netstat | Where-Object { $_ -match 'LISTENING' } | Select-Object -First 1)
  }
}

Set-Location $ProjectRoot

if (Test-PortListening -TargetPort $Port) {
  Write-Host "Waiting on http://localhost:$Port (already running)"
  exit 0
}

Write-Host "Starting Expo web on http://localhost:$Port"
npm run web
