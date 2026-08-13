# Converte PDFs → JPG em C:\IBN Tesouraria\Comprovantes
# Uso:
#   .\scripts\convert-pdf-folder-to-jpg.ps1
#   .\scripts\convert-pdf-folder-to-jpg.ps1 -Force
#   .\scripts\convert-pdf-folder-to-jpg.ps1 -Limit 5

param(
  [string]$InDir = 'C:\IBN Tesouraria\Comprovantes\PDF',
  [string]$OutDir = 'C:\IBN Tesouraria\Comprovantes\JPG',
  [switch]$Force,
  [int]$Limit = 0,
  [double]$Scale = 2,
  [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$argsList = @(
  'scripts/convert-pdf-folder-to-jpg.mjs',
  '--in', $InDir,
  '--out', $OutDir,
  '--scale', "$Scale",
  '--quality', "$Quality"
)

if ($Force) { $argsList += '--force' }
if ($Limit -gt 0) { $argsList += @('--limit', "$Limit") }

node @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
