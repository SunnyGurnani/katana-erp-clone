@echo off
title Forge ERP - Local Server
echo ============================================
echo   Forge ERP (Katana Clone) - Local Startup
echo ============================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first, then run this again.
    echo.
    pause
    exit /b 1
)

echo [1/3] Pulling latest images...
docker compose -f docker-compose.local.yml pull postgres minio nginx

echo.
echo [2/3] Building and starting all containers...
echo       This may take 5-10 minutes on first run.
echo.
docker compose -f docker-compose.local.yml up --build -d

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Something went wrong. Check the logs:
    echo   docker compose -f docker-compose.local.yml logs
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Waiting for services to be ready...
timeout /t 15 /nobreak >nul

echo.
echo ============================================
echo   All services started successfully!
echo ============================================
echo.
echo   App:        http://localhost
echo   Login:      admin@forgeerp.com
echo   Password:   Admin1234!
echo.
echo   MinIO Console: http://localhost:9001
echo   MinIO Login:   minioadmin / minioadmin123
echo.
echo   To view logs:  docker compose -f docker-compose.local.yml logs -f
echo   To stop:       docker compose -f docker-compose.local.yml down
echo   To stop+wipe:  docker compose -f docker-compose.local.yml down -v
echo.
echo ============================================
echo Press any key to open the app in your browser...
pause >nul
start http://localhost
