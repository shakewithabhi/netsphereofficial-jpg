# ByteBox Production Deployment

## Server Info
- **IP:** `178.156.255.1`
- **Domain:** `bytebox.com`
- **Deploy method:** Docker Compose (fully isolated)
- **Storage:** MinIO (self-hosted S3)

---

## Pre-Deploy: DNS Setup
Point these DNS records to the server **before** running setup:
```
bytebox.com      A    178.156.255.1
www.bytebox.com  A    178.156.255.1
```

---

## First-Time Deploy

```bash
# 1. SSH into server
ssh root@178.156.255.1

# 2. Clone project
git clone <your-repo-url> /opt/bytebox

# 3. Run setup (installs Docker, generates secrets, gets SSL, starts everything)
cd /opt/bytebox
bash infra/scripts/setup-server.sh
```

The setup script automatically:
- Installs Docker + Docker Compose
- Installs Certbot
- Generates all secrets (DB, Redis, MinIO, JWT, TOTP)
- Creates `.env.production` with generated secrets
- Gets SSL certificate for bytebox.com
- Builds all Docker images
- Starts all services
- Runs database migrations
- Sets up SSL auto-renewal cron

---

## Subsequent Deploys

```bash
ssh root@178.156.255.1
cd /opt/bytebox
bash infra/scripts/deploy-production.sh
```

---

## Useful Commands

```bash
cd /opt/bytebox/infra

# Status
docker compose -f docker-compose.production.yml ps

# Logs (all)
docker compose -f docker-compose.production.yml logs -f

# Logs (specific service)
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f nginx

# Restart
docker compose -f docker-compose.production.yml restart

# Stop
docker compose -f docker-compose.production.yml --env-file .env.production down

# Database migrations
bash /opt/bytebox/infra/scripts/migrate.sh up
bash /opt/bytebox/infra/scripts/migrate.sh down 1
bash /opt/bytebox/infra/scripts/migrate.sh version
```

---

## Architecture (Docker)

```
Host (178.156.255.1)
│
├── Port 80  ─→ bytebox-nginx ─→ HTTPS redirect
├── Port 443 ─→ bytebox-nginx
│                ├── /api/*    → bytebox-api:8080
│                ├── /health   → bytebox-api:8080
│                ├── /s/*      → bytebox-api:8080
│                └── /*        → bytebox-admin:80
│
└── Internal Docker Network (bytebox-net)
    ├── bytebox-postgres  (5432, not exposed)
    ├── bytebox-redis     (6379, not exposed)
    ├── bytebox-minio     (9000, not exposed)
    ├── bytebox-api       (8080, not exposed)
    ├── bytebox-worker    (background jobs)
    └── bytebox-admin     (80, not exposed)
```

No ports conflict with other projects. Everything runs inside Docker.

---

## Files

| File | Purpose |
|------|---------|
| `infra/docker-compose.production.yml` | All services |
| `infra/nginx/nginx-production.conf` | Nginx reverse proxy + SSL |
| `infra/.env.production` | Secrets (auto-generated on server) |
| `infra/scripts/setup-server.sh` | First-time setup |
| `infra/scripts/deploy-production.sh` | Redeploy |
| `infra/scripts/migrate.sh` | Database migrations |
| `backend/Dockerfile` | Go API + Worker image |
| `admin/Dockerfile` | Admin dashboard image |

---

## Optional (add later)
- [ ] Cloudflare R2 (replace MinIO — change STORAGE_ENDPOINT in .env.production)
- [ ] Google OAuth (set GOOGLE_CLIENT_ID/SECRET)
- [ ] Stripe payments (set STRIPE keys)
- [ ] Meilisearch (add to docker-compose, set MEILISEARCH_HOST)
- [ ] Cloudflare Stream (set CF_STREAM keys)
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Play Store listing
