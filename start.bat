@echo off
title Sporty vzw Logistiek
echo ============================================
echo   Sporty vzw Logistiek App
echo ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo FOUT: Node.js is niet geinstalleerd!
    echo Ga naar https://nodejs.org en installeer de LTS versie.
    echo.
    pause
    exit /b
)

echo Eventuele oude server stoppen...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

cd /d "%~dp0backend"

echo Bestanden controleren...
npm install --ignore-scripts >nul 2>&1

echo.
echo ============================================
echo   App gestart op http://localhost:3001
echo   Open je browser en surf naar dat adres.
echo   Sluit dit venster NIET tijdens gebruik!
echo ============================================
echo.

node server.js

echo.
echo Server gestopt. Foutmelding hierboven indien probleem.
pause
