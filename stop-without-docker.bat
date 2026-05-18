@echo off
title ForgeERP - Stop (No Docker)
echo Stopping processes on ports 3000 and 8000...

for %%P in (3000 8000) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo Done.
pause
