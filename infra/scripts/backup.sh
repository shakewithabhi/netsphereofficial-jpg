#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backups/bytebox"
DATE=$(date +%Y%m%d_%H%M%S)
RETAIN_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "=== ByteBox Backup ($DATE) ==="

# PostgreSQL backup
echo "→ Backing up PostgreSQL..."
docker exec bytebox-postgres pg_dump -U bytebox bytebox | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Cleanup old backups
echo "→ Cleaning up backups older than $RETAIN_DAYS days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETAIN_DAYS -delete

echo "✓ Backup complete: $BACKUP_DIR/db_$DATE.sql.gz"
echo "  Size: $(du -h "$BACKUP_DIR/db_$DATE.sql.gz" | cut -f1)"
