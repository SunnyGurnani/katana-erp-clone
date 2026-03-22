#!/bin/bash
set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

echo "=== ForgeERP Backup — $DATE ==="

# Dump PostgreSQL
echo "Backing up database..."
docker compose exec -T postgres pg_dump -U forge forgeerp > "$BACKUP_DIR/db_$DATE.sql"
gzip "$BACKUP_DIR/db_$DATE.sql"
echo "✓ Database → $BACKUP_DIR/db_$DATE.sql.gz"

# Backup MinIO data
echo "Backing up file storage..."
docker run --rm \
  --volumes-from $(docker compose ps -q minio) \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine tar czf /backup/minio_$DATE.tar.gz /data 2>/dev/null || true
echo "✓ Files → $BACKUP_DIR/minio_$DATE.tar.gz"

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

echo ""
echo "=== Backup Complete ==="
ls -lh $BACKUP_DIR/*$DATE*
