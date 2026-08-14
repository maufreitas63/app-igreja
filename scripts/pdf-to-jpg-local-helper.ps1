# Conversor local PDF→JPG. Deixe esta janela aberta.
# Abra http://127.0.0.1:47821

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
node scripts/pdf-to-jpg-local-helper.mjs
