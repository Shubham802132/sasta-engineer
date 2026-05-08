@echo off
title FIXGHAR - Start Both Servers
color 0A

echo ========================================
echo    FIXGHAR - Starting Both Servers
echo ========================================
echo.

echo Starting Backend Server...
start "FIXGHAR Backend" cmd /k "cd /d %~dp0backend && npm start"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "FIXGHAR Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo ========================================
echo   Both servers are starting!
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3030
echo ========================================
echo.
echo Opening application in browser...
timeout /t 5 /nobreak >nul
start http://localhost:3030

echo.
echo Application should now be open in your browser!
echo Press any key to exit this window...
pause >nul






