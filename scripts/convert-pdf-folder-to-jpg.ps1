# Converte PDFs → JPG apenas na pasta citada (sem subpastas).
# Padrão: C:\IBN Tesouraria\Comprovantes\JPG
#
# Uso:
#   .\scripts\convert-pdf-folder-to-jpg.ps1
#   .\scripts\convert-pdf-folder-to-jpg.ps1 -Force
#   .\scripts\convert-pdf-folder-to-jpg.ps1 -Limit 5

param(
  [string]$Dir = 'C:\IBN Tesouraria\Comprovantes\JPG',
  [string]$OutDir = '',
  [switch]$Force,
  [int]$Limit = 0,
  [double]$Scale = 2,
  [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $OutDir) { $OutDir = $Dir }

$argsList = @(
  'scripts/convert-pdf-folder-to-jpg.mjs',
  '--in', $Dir,
  '--out', $OutDir,
  '--scale', "$Scale",
  '--quality', "$Quality"
)

if ($Force) { $argsList += '--force' }
if ($Limit -gt 0) { $argsList += @('--limit', "$Limit") }

node @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
