#!/bin/bash
echo "============================================"
echo "  Forge ERP (Katana Clone) - Local Startup"
echo "============================================"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker is not running!"
    echo "Please start Docker first, then run this again."
    exit 1
fi

echo "[1/3] Pulling latest images..."
docker compose -f docker-compose.local.yml pull postgres minio nginx

echo ""
echo "[2/3] Building and starting all containers..."
echo "      This may take 5-10 minutes on first run."
echo ""
docker compose -f docker-compose.local.yml up --build -d

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Something went wrong. Check the logs:"
    echo "  docker compose -f docker-compose.local.yml logs"
    exit 1
fi

echo ""
echo "[3/3] Waiting for services to be ready..."
sleep 15

echo ""
echo "============================================"
echo "  All services started successfully!"
echo "============================================"
echo ""
echo "  App:        http://localhost"
echo "  Login:      admin@forgeerp.com"
echo "  Password:   Admin1234!"
echo ""
echo "  MinIO Console: http://localhost:9001"
echo "  MinIO Login:   minioadmin / minioadmin123"
echo ""
echo "  To view logs:  docker compose -f docker-compose.local.yml logs -f"
echo "  To stop:       docker compose -f docker-compose.local.yml down"
echo "  To stop+wipe:  docker compose -f docker-compose.local.yml down -v"
echo ""
echo "============================================"

# Open in browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost
elif command -v open &> /dev/null; then
    open http://localhost
fi
