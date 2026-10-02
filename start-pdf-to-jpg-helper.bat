@echo off
setlocal
cd /d "%~dp0"

title Conversor PDF para JPG (helper local)
echo.
echo  Deixe esta janela aberta.
echo  Depois use o botao "Converter PDF - JPG" no app.
echo  URL: http://127.0.0.1:47821
echo.

call npm run pdf-to-jpg:helper

echo.
echo Helper encerrado.
pause
endlocal
