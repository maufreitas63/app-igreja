$ErrorActionPreference = 'Stop'
$TaskName = 'AppIgreja-MetroWatchdog'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
} else {
  Write-Host "Task '$TaskName' was not installed."
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LockFile = Join-Path $ProjectRoot '.metro-watchdog.lock'
if (Test-Path $LockFile) {
  try {
    $pid = [int](Get-Content -Path $LockFile -TotalCount 1)
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  } catch {
    # ignore
  }
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

Write-Host 'Stopped watchdog lock file (if any).'
