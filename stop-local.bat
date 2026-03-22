@echo off
title Forge ERP - Stop Server
echo Stopping all Forge ERP containers...
docker compose -f docker-compose.local.yml down
echo.
echo All containers stopped.
echo To also delete all data, run: docker compose -f docker-compose.local.yml down -v
pause
