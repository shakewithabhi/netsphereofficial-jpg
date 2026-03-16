#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== ByteBox Deploy ==="

# Check .env.production exists
if [ ! -f "$INFRA_DIR/.env.production" ]; then
    echo "ERROR: .env.production not found. Copy from .env.production.example and configure."
    exit 1
fi

cd "$INFRA_DIR"

# Pull latest code
echo "→ Pulling latest code..."
git pull origin main

# Build and deploy
echo "→ Building images..."
docker compose build

# Run database migrations
echo "→ Running migrations..."
docker compose run --rm api sh -c "./server migrate-up 2>/dev/null || echo 'Migration command not available, skipping'"

# Restart services
echo "→ Starting services..."
docker compose up -d

# Wait for health check
echo "→ Checking health..."
sleep 5
if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✓ Deploy successful! Server is healthy."
else
    echo "⚠ Health check failed. Check logs: docker compose logs"
    exit 1
fi

echo "=== Deploy Complete ==="
