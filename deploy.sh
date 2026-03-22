#!/bin/bash
set -e

echo "=== ForgeERP (Katana Clone) — Production Deployment ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker installed. Log out and back in, then re-run this script."
    exit 0
fi

# Check docker compose
if ! docker compose version &> /dev/null; then
    echo "ERROR: docker compose not found. Install Docker Compose v2."
    exit 1
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.production .env
    # Generate random passwords
    DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
    MINIO_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

    sed -i "s/CHANGE_ME_strong_password_here/$DB_PASS/g" .env
    sed -i "s/CHANGE_ME_at_least_32_chars_random_string/$SECRET/" .env
    sed -i "s/CHANGE_ME_minio_password/$MINIO_PASS/" .env

    echo "✓ Generated random passwords in .env"
    echo "  IMPORTANT: Update ALLOWED_ORIGINS and PUBLIC_API_URL with your domain"
fi

# Create nginx certs directory
mkdir -p nginx/certs

# Build and start
echo ""
echo "Building containers..."
docker compose build

echo ""
echo "Starting services..."
docker compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check health
echo ""
echo "=== Service Status ==="
docker compose ps

echo ""
echo "=== Health Check ==="
curl -sf http://localhost/health && echo " ✓ API healthy" || echo " ✗ API not responding (may still be starting)"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Access your ERP at: http://$(hostname -I | awk '{print $1}')"
echo "MinIO Console at:   http://$(hostname -I | awk '{print $1}')/minio-console/"
echo ""
echo "Default login: admin@forgeerp.com / Admin1234!"
echo ""
echo "Next steps:"
echo "  1. Update .env with your domain name"
echo "  2. Run: ./setup-ssl.sh your-domain.com  (for HTTPS)"
echo "  3. Change the default admin password"
