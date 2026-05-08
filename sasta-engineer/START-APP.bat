@echo off
title FIXGHAR - Quick Start
color 0A

echo ========================================
echo    FIXGHAR Quick Start
echo ========================================

echo Freeing up ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3030') do taskkill /PID %%a /F >nul 2>&1

echo Starting servers...
start "Backend" cmd /k "cd /d %~dp0backend && npm start"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "cd /d %~dp0frontend && npm start"
timeout /t 3 /nobreak >nul

echo Opening app...
start http://localhost:3030

echo Done! App should be opening...
timeout /t 2 /nobreak >nul
exit






