#!/bin/bash
set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./setup-ssl.sh your-domain.com"
    exit 1
fi

echo "=== Setting up SSL for $DOMAIN ==="

# Get certificate
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@$DOMAIN \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Update nginx config to enable SSL
sed -i "s/your-domain.com/$DOMAIN/g" nginx/nginx.conf
sed -i 's/# listen 443 ssl/listen 443 ssl/' nginx/nginx.conf
sed -i 's/# ssl_certificate/ssl_certificate/' nginx/nginx.conf
sed -i 's/# server_name/server_name/' nginx/nginx.conf

# Uncomment HTTPS redirect block
sed -i '/# HTTP -> HTTPS redirect/,/# }/s/# //' nginx/nginx.conf

# Update .env
sed -i "s|PUBLIC_API_URL=.*|PUBLIC_API_URL=https://$DOMAIN|" .env
sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://$DOMAIN|" .env
sed -i "s|MINIO_PUBLIC_URL=.*|MINIO_PUBLIC_URL=https://$DOMAIN/files|" .env

# Rebuild web with correct API URL
docker compose build web
docker compose up -d

echo ""
echo "✓ SSL configured for $DOMAIN"
echo "  Access at: https://$DOMAIN"
