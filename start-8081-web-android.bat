@echo off
setlocal
cd /d "%~dp0"

title Expo 8081 - Web + Android
echo.
echo  Projeto: %CD%
echo  Porta:   8081
echo  Alvos:   Web (navegador) + Android (emulador/dispositivo na LAN)
echo.

REM Metro unico atende web e Android na mesma porta.
REM --host lan: celular/emulador na rede local encontra o bundler.
call npx expo start --port 8081 --host lan --web --android

echo.
echo Servidor encerrado.
pause
endlocal
