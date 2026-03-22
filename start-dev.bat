@echo off
title Forge ERP - Frontend Preview (No Docker)
echo ============================================
echo   Forge ERP - Quick Frontend Preview
echo   (No Docker needed - just Node.js)
echo ============================================
echo.

:: Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Download it from https://nodejs.org (pick LTS)
    echo Then rerun this script.
    pause
    exit /b 1
)

:: Check pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing pnpm...
    call npm install -g pnpm
)

echo.
echo [1/2] Installing dependencies (first time only)...
call pnpm install

echo.
echo [2/2] Starting frontend...
echo.
echo ============================================
echo   Opening http://localhost:3000 
echo   Press Ctrl+C to stop
echo ============================================
echo.

cd apps\web
start http://localhost:3000
call pnpm dev
