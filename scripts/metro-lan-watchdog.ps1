# Keeps Expo Metro available on LAN (port 8081). Restarts when the port is down.
param(
  [int] $IntervalSeconds = 90,
  [int] $Port = 8081,
  # Tempo máximo aguardando Metro abrir a porta (cold start no Windows pode levar 1–2 min).
  [int] $StartupTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $ProjectRoot '.metro-watchdog.log'
$LockFile = Join-Path $ProjectRoot '.metro-watchdog.lock'

function Write-Log([string] $Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Test-MetroPortListening([int] $TargetPort) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    return [bool]($connections | Select-Object -First 1)
  } catch {
    $netstat = netstat -ano | Select-String ":$TargetPort\s"
    return [bool]($netstat | Where-Object { $_ -match 'LISTENING' } | Select-Object -First 1)
  }
}

function Wait-MetroPort([int] $TargetPort, [int] $TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    if (Test-MetroPortListening -TargetPort $TargetPort) {
      return $true
    }

    Start-Sleep -Seconds 3
  }

  return $false
}

function Start-MetroLan {
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npx) {
    Write-Log 'ERROR: npx not found in PATH.'
    return
  }

  Write-Log "Starting Metro: npx expo start --host lan --port $Port (timeout ${StartupTimeoutSeconds}s)"
  Start-Process `
    -FilePath $npx.Source `
    -ArgumentList @('expo', 'start', '--host', 'lan', '--port', "$Port") `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Minimized

  if (Wait-MetroPort -TargetPort $Port -TimeoutSeconds $StartupTimeoutSeconds) {
    Write-Log "Metro is listening on port $Port."
  } else {
    Write-Log "Metro did not open port $Port within ${StartupTimeoutSeconds}s."
  }
}

# Single watchdog instance per machine/project.
if (Test-Path $LockFile) {
  try {
    $existingPid = [int](Get-Content -Path $LockFile -TotalCount 1)
    $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Log "Watchdog already running (PID $existingPid). Exiting."
      exit 0
    }
  } catch {
    # Stale lock; continue.
  }
}

Set-Content -Path $LockFile -Value $PID -Encoding ASCII
Write-Log "Watchdog started (PID $PID). Project: $ProjectRoot"

try {
  while ($true) {
    if (Test-MetroPortListening -TargetPort $Port) {
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    if (-not (Test-MetroPortListening -TargetPort $Port)) {
      Write-Log "Port $Port is not listening. Starting Metro..."
      Start-MetroLan
    }

    Start-Sleep -Seconds $IntervalSeconds
  }
} finally {
  if (Test-Path $LockFile) {
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
  }
}
