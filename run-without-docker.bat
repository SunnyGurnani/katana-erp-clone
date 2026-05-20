@echo off
setlocal EnableDelayedExpansion
title ForgeERP - Run Without Docker
cd /d "%~dp0"

echo ============================================================
echo   ForgeERP - Local run WITHOUT Docker
echo   Node + pnpm + PostgreSQL (native or WSL)
echo ============================================================
echo.

:: --- Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Download LTS from https://nodejs.org and run this script again.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js !NODE_VER!

:: --- npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found ^(should come with Node.js^).
    pause
    exit /b 1
)

:: --- pnpm ---
set PNPM=pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pnpm not in PATH - using npx pnpm...
    set PNPM=npx --yes pnpm
)

:: --- PostgreSQL detection ---
set PG_OK=0
set PG_NOTE=

where psql >nul 2>&1
if %errorlevel% equ 0 (
    set PG_OK=1
    set PG_NOTE=psql found in PATH
    goto :pg_found
)

where pg_isready >nul 2>&1
if %errorlevel% equ 0 (
    pg_isready -h localhost -p 5432 >nul 2>&1
    if !errorlevel! equ 0 (
        set PG_OK=1
        set PG_NOTE=pg_isready localhost:5432
        goto :pg_found
    )
)

:: Windows PostgreSQL service
for /f "tokens=2 delims=:" %%a in ('sc query type^= service state^= all ^| findstr /i "postgresql"') do (
    sc query "%%a" 2>nul | findstr /i "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        set PG_OK=1
        set PG_NOTE=Windows service running
        goto :pg_found
    )
)

:: WSL PostgreSQL (common on this project)
where wsl >nul 2>&1
if %errorlevel% equ 0 (
    wsl -e pg_isready -h localhost -p 5432 >nul 2>&1
    if !errorlevel! equ 0 (
        set PG_OK=1
        set PG_NOTE=WSL PostgreSQL on port 5432
        goto :pg_found
    )
    wsl -e bash -lc "command -v psql" >nul 2>&1
    if !errorlevel! equ 0 (
        set PG_OK=1
        set PG_NOTE=WSL has psql (ensure Postgres is started in WSL)
        goto :pg_found
    )
)

:pg_found
if %PG_OK% equ 0 (
    echo.
    echo [WARN] PostgreSQL was not detected on localhost:5432.
    echo        Install PostgreSQL 15+ for Windows: https://www.postgresql.org/download/windows/
    echo        Or use WSL:  sudo apt install postgresql
    echo        Then create a database and set DATABASE_URL in apps\api\.env
    echo.
    set /p CONTINUE=Continue anyway? ^(y/N^): 
    if /i not "!CONTINUE!"=="y" exit /b 1
) else (
    echo [OK] PostgreSQL - !PG_NOTE!
)

:: --- Environment files ---
if not exist "apps\api\.env" (
    echo [INFO] Creating apps\api\.env from .env.example...
    copy /y ".env.example" "apps\api\.env" >nul
    powershell -NoProfile -Command "(Get-Content 'apps\api\.env' -Raw) -replace 'PORT=4000','PORT=8000' -replace 'NEXT_PUBLIC_API_URL=http://localhost:4000','NEXT_PUBLIC_API_URL=http://localhost:8000' | Set-Content 'apps\api\.env' -Encoding UTF8"
)

if not exist "apps\web\.env.local" (
    echo [INFO] Creating apps\web\.env.local...
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:8000
    ) > "apps\web\.env.local"
)

if not exist ".env" (
    copy /y "apps\api\.env" ".env" >nul 2>&1
)

echo.
echo [1/5] Installing dependencies...
call %PNPM% install
if %errorlevel% neq 0 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
)

echo.
echo [2/5] Generating Prisma client...
cd apps\api
call %PNPM% exec prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] prisma generate failed. Check DATABASE_URL in apps\api\.env
    cd /d "%~dp0"
    pause
    exit /b 1
)

echo.
echo [3/5] Applying database schema...
call %PNPM% exec prisma migrate deploy
if %errorlevel% neq 0 (
    echo [WARN] migrate deploy failed - trying db push...
    call %PNPM% exec prisma db push
    if !errorlevel! neq 0 (
        echo [ERROR] Database setup failed. Fix PostgreSQL / DATABASE_URL and retry.
        cd /d "%~dp0"
        pause
        exit /b 1
    )
)
cd /d "%~dp0"

echo.
echo [4/5] Seeding database (safe to re-run)...
call %PNPM% db:seed
if %errorlevel% neq 0 (
    echo [WARN] Seed failed - you can still try starting the app.
)

echo.
echo [5/5] Clearing stale Next.js cache...
if exist "apps\web\.next" rmdir /s /q "apps\web\.next" 2>nul

echo.
echo ============================================================
echo   Starting ForgeERP (API :8000 + Web :3000)
echo ============================================================
echo   Login:  http://localhost:3000/login
echo   Email:  admin@forgeerp.com
echo   Pass:   Admin1234!
echo.
echo   Press Ctrl+C to stop both servers.
echo ============================================================
echo.

start "" "http://localhost:3000/login"
call %PNPM% dev

pause
