# Registers a Windows scheduled task to run the Metro LAN watchdog at user logon.
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WatchdogScript = Join-Path $PSScriptRoot 'metro-lan-watchdog.ps1'
$TaskName = 'AppIgreja-MetroWatchdog'

if (-not (Test-Path $WatchdogScript)) {
  throw "Watchdog script not found: $WatchdogScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchdogScript`"" `
  -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Keeps Expo Metro (LAN / port 8081) running for app-igreja.' `
  | Out-Null

Write-Host "Scheduled task '$TaskName' installed."
Write-Host 'It runs at Windows logon and restarts Metro when port 8081 is down.'
Write-Host ''
Write-Host 'Start watchdog now (optional):'
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`""
Write-Host ''
Write-Host 'Remove task:'
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\uninstall-metro-watchdog-task.ps1`""
