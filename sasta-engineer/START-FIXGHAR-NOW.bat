@echo off
title FIXGHAR - Smart Server Launcher
color 0A

echo ========================================
echo    FIXGHAR Smart Server Launcher
echo ========================================
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo ========================================
echo   Checking and freeing up ports...
echo ========================================

echo Checking port 5000 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process %%a on port 5000...
    taskkill /PID %%a /F >nul 2>&1
)

echo Checking port 3030 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3030') do (
    echo Killing process %%a on port 3030...
    taskkill /PID %%a /F >nul 2>&1
)

echo Ports cleared! Starting servers...
echo.

echo ========================================
echo   Starting Backend Server...
echo ========================================

cd /d "%~dp0backend"

echo Current directory: %CD%
echo.

echo Checking backend dependencies...
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install backend dependencies
        pause
        exit /b 1
    )
    echo Backend dependencies installed successfully!
    echo.
)

echo Starting backend server in new window...
start "FIXGHAR Backend" cmd /k "cd /d %CD% & npm start"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo ========================================
echo   Starting Frontend Server...
echo ========================================

cd /d "%~dp0frontend"

echo Current directory: %CD%
echo.

echo Checking frontend dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
    echo Frontend dependencies installed successfully!
    echo.
)

echo Starting frontend server in new window...
start "FIXGHAR Frontend" cmd /k "cd /d %CD% & npm start"

echo Waiting 5 seconds for frontend to start...
timeout /t 5 /nobreak >nul

echo ========================================
echo   Opening Application in Browser...
echo ========================================

start http://localhost:3030

echo.
echo ========================================
echo   FIXGHAR Application Started!
echo ========================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3030
echo   Health:   http://localhost:5000/api/health
echo ========================================
echo.
echo Both servers are running in separate windows.
echo Application should be open in your browser.
echo.
echo Press any key to exit this launcher...
pause >nul