# Helper local para o botão PDF→JPG do PWA.
# Deixe esta janela aberta. O PWA chama http://127.0.0.1:47821

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
node scripts/pdf-to-jpg-local-helper.mjs
