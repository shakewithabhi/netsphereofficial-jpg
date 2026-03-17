#!/bin/bash
set -euo pipefail

# ByteBox Database Migration Script
# Usage:
#   bash infra/scripts/migrate.sh up       — apply all pending migrations
#   bash infra/scripts/migrate.sh down 1   — rollback last migration
#   bash infra/scripts/migrate.sh version  — show current version

INFRA_DIR="/opt/bytebox/infra"
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"

cd "$INFRA_DIR"
source .env.production

ACTION="${1:-up}"
STEPS="${2:-}"

DB_URL="postgres://${DB_USER:-bytebox}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-bytebox}?sslmode=disable"

echo "→ Running migration: $ACTION $STEPS"

$COMPOSE exec -T api migrate -path ./migrations -database "$DB_URL" $ACTION $STEPS

echo "✓ Migration complete"
