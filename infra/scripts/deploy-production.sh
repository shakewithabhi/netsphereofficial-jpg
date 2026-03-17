#!/bin/bash
set -euo pipefail

# ByteBox Production Deploy Script
# Run from project root: bash infra/scripts/deploy-production.sh

PROJECT_DIR="/opt/bytebox"
INFRA_DIR="$PROJECT_DIR/infra"
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"

echo "=== ByteBox Deploy ==="

cd "$INFRA_DIR"

# Check .env.production exists
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found. Run setup-server.sh first."
    exit 1
fi

# Pull latest code
echo "→ Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin main

# Rebuild images
echo "→ Building images..."
cd "$INFRA_DIR"
$COMPOSE build

# Run database migrations
echo "→ Running migrations..."
source .env.production
$COMPOSE exec -T api \
    migrate -path ./migrations -database "postgres://${DB_USER:-bytebox}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-bytebox}?sslmode=disable" up \
    || echo "⚠ Migrations may already be up to date"

# Restart services
echo "→ Restarting services..."
$COMPOSE up -d

# Health check
echo "→ Checking health..."
sleep 5

if curl -sf https://bytebox.com/health > /dev/null 2>&1; then
    echo "✓ Deploy successful! Server is healthy."
elif curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✓ Deploy successful! (HTTP only)"
else
    echo "⚠ Health check failed. Check: $COMPOSE logs"
    exit 1
fi

echo "=== Deploy Complete ==="
