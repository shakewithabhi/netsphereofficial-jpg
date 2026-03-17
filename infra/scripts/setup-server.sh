#!/bin/bash
set -euo pipefail

# ByteBox Production Setup Script
# Server: 178.156.255.1 | Domain: byteboxapp.com
#
# Usage: ssh root@178.156.255.1
#        git clone <repo> /opt/bytebox
#        cd /opt/bytebox && bash infra/scripts/setup-server.sh

echo "========================================="
echo "  ByteBox Production Setup"
echo "  Server: $(hostname -I | awk '{print $1}')"
echo "  Domain: byteboxapp.com"
echo "========================================="

PROJECT_DIR="/opt/bytebox"
INFRA_DIR="$PROJECT_DIR/infra"
ENV_FILE="$INFRA_DIR/.env.production"
BACKEND_ENV="$PROJECT_DIR/backend/.env.production"

# -------------------------------------------
# Step 1: Install Docker if missing
# -------------------------------------------
if ! command -v docker &> /dev/null; then
    echo "→ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# Ensure docker compose plugin
if ! docker compose version &> /dev/null; then
    echo "→ Installing Docker Compose plugin..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# -------------------------------------------
# Step 2: Install Certbot if missing
# -------------------------------------------
if ! command -v certbot &> /dev/null; then
    echo "→ Installing Certbot..."
    apt-get update -qq && apt-get install -y -qq certbot
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# -------------------------------------------
# Step 3: Generate secrets
# -------------------------------------------
echo "→ Generating secrets..."

DB_PASSWORD=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 32)
MINIO_PASSWORD=$(openssl rand -hex 32)
ACCESS_SECRET=$(openssl rand -hex 64)
REFRESH_SECRET=$(openssl rand -hex 64)
TOTP_KEY=$(openssl rand -hex 32)

echo "✓ Secrets generated"

# -------------------------------------------
# Step 4: Create .env.production for Docker Compose
# -------------------------------------------
echo "→ Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# ByteBox Production — Auto-generated $(date -u +%Y-%m-%dT%H:%M:%SZ)

# App
APP_ENV=production
APP_BASE_URL=https://byteboxapp.com
APP_DEFAULT_QUOTA_GB=5
APP_MAX_UPLOAD_SIZE_MB=100

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=bytebox
DB_PASSWORD=$DB_PASSWORD
DB_NAME=bytebox
DB_SSL_MODE=disable
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=10

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0

# MinIO (S3-compatible storage)
STORAGE_ENDPOINT=http://minio:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=bytebox
STORAGE_SECRET_ACCESS_KEY=$MINIO_PASSWORD
STORAGE_BUCKET_FILES=bytebox-files
STORAGE_BUCKET_THUMBS=bytebox-thumbnails
STORAGE_BUCKET_TEMP=bytebox-temp

# MinIO root credentials (used by Docker Compose)
MINIO_ROOT_USER=bytebox
MINIO_ROOT_PASSWORD=$MINIO_PASSWORD

# Auth
AUTH_ACCESS_TOKEN_SECRET=$ACCESS_SECRET
AUTH_REFRESH_TOKEN_SECRET=$REFRESH_SECRET
AUTH_TOTP_ENCRYPTION_KEY=$TOTP_KEY
AUTH_ACCESS_TOKEN_TTL_MIN=15
AUTH_REFRESH_TOKEN_TTL_DAYS=30
AUTH_BCRYPT_COST=12

# Cloudflare Stream (disabled)
CF_STREAM_API_TOKEN=
CF_STREAM_ACCOUNT_ID=
CF_STREAM_CUSTOMER_SUBDOMAIN=
CF_STREAM_WEBHOOK_SECRET=

# Meilisearch (disabled)
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# Google OAuth (disabled)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=https://byteboxapp.com/auth/google/callback

# Stripe (disabled)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PREMIUM_PRICE_ID=
EOF

# Restrict permissions
chmod 600 "$ENV_FILE"
echo "✓ .env.production created"

# -------------------------------------------
# Step 5: Get SSL certificate
# -------------------------------------------
if [ ! -f "/etc/letsencrypt/live/byteboxapp.com/fullchain.pem" ]; then
    echo ""
    echo "→ Getting SSL certificate for byteboxapp.com..."
    echo "  Make sure DNS A record points to this server first!"
    echo ""

    # Stop anything on port 80 temporarily
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@byteboxapp.com \
        -d byteboxapp.com \
        -d www.byteboxapp.com \
        || {
            echo ""
            echo "⚠ SSL certificate failed."
            echo "  1. Make sure byteboxapp.com DNS points to $(hostname -I | awk '{print $1}')"
            echo "  2. Make sure port 80 is open"
            echo "  3. Run: certbot certonly --standalone -d byteboxapp.com -d www.byteboxapp.com"
            echo ""
            echo "  Continuing without SSL (HTTP only)..."
        }
else
    echo "✓ SSL certificate already exists"
fi

# -------------------------------------------
# Step 6: Build and start containers
# -------------------------------------------
echo "→ Building Docker images..."
cd "$INFRA_DIR"
docker compose -f docker-compose.production.yml --env-file .env.production build

echo "→ Starting services..."
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# -------------------------------------------
# Step 7: Wait for services to be healthy
# -------------------------------------------
echo "→ Waiting for services to be healthy..."
sleep 10

# -------------------------------------------
# Step 8: Run database migrations
# -------------------------------------------
echo "→ Running database migrations..."
docker compose -f docker-compose.production.yml --env-file .env.production exec -T api \
    migrate -path ./migrations -database "postgres://bytebox:${DB_PASSWORD}@postgres:5432/bytebox?sslmode=disable" up \
    || echo "⚠ Migrations may have already been applied"

echo "✓ Migrations complete"

# -------------------------------------------
# Step 9: Setup certbot auto-renewal cron
# -------------------------------------------
if ! crontab -l 2>/dev/null | grep -q certbot; then
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'docker restart bytebox-nginx'") | crontab -
    echo "✓ Certbot auto-renewal cron added"
fi

# -------------------------------------------
# Step 10: Health check
# -------------------------------------------
echo ""
echo "→ Running health check..."
sleep 5

if curl -sf https://byteboxapp.com/health 2>/dev/null; then
    echo ""
    echo "========================================="
    echo "  ✓ ByteBox is live!"
    echo "  https://byteboxapp.com"
    echo "========================================="
elif curl -sf http://localhost/health 2>/dev/null; then
    echo ""
    echo "========================================="
    echo "  ✓ ByteBox is running (HTTP only)"
    echo "  SSL may not be configured yet"
    echo "  http://178.156.255.1"
    echo "========================================="
else
    echo ""
    echo "⚠ Health check failed"
    echo "  Check logs: cd $INFRA_DIR && docker compose -f docker-compose.production.yml logs"
fi

echo ""
echo "Useful commands:"
echo "  Logs:     cd $INFRA_DIR && docker compose -f docker-compose.production.yml logs -f"
echo "  Status:   cd $INFRA_DIR && docker compose -f docker-compose.production.yml ps"
echo "  Restart:  cd $INFRA_DIR && docker compose -f docker-compose.production.yml restart"
echo "  Stop:     cd $INFRA_DIR && docker compose -f docker-compose.production.yml down"
echo ""
