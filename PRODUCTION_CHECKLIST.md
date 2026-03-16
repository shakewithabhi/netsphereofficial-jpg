# ByteBox Production Checklist

## Get These First
- [ ] Domain name (e.g., `bytebox.app`)
- [ ] VPS server (Ubuntu, 2CPU/4GB RAM)
- [ ] Cloudflare account (for R2 storage)

## On Your Server — Install
- [ ] PostgreSQL
- [ ] Redis
- [ ] Nginx
- [ ] Certbot (SSL)
- [ ] Go runtime (to build backend)

## Generate Secrets
- [ ] `DB_PASSWORD` — `openssl rand -hex 32`
- [ ] `REDIS_PASSWORD` — `openssl rand -hex 32`
- [ ] `AUTH_ACCESS_TOKEN_SECRET` — `openssl rand -hex 64`
- [ ] `AUTH_REFRESH_TOKEN_SECRET` — `openssl rand -hex 64`
- [ ] `AUTH_TOTP_ENCRYPTION_KEY` — `openssl rand -hex 32`

## Cloudflare R2 Setup
- [ ] Create R2 bucket: `bytebox-files`
- [ ] Create R2 bucket: `bytebox-thumbnails`
- [ ] Create R2 bucket: `bytebox-temp`
- [ ] Get R2 Access Key ID
- [ ] Get R2 Secret Access Key
- [ ] Get R2 endpoint URL

## Backend Config (.env.production)
- [ ] Set `APP_ENV=production`
- [ ] Set `APP_BASE_URL=https://yourdomain.com`
- [ ] Set `APP_MAX_UPLOAD_SIZE_MB=100`
- [ ] Set DB password
- [ ] Set Redis password
- [ ] Set `DB_SSL_MODE=require`
- [ ] Set R2 storage endpoint + keys
- [ ] Set auth secrets

## Android Code Changes
- [ ] Update release `BASE_URL` in `app/build.gradle.kts`
- [ ] Remove test credentials from `app/build.gradle.kts`
- [ ] Fix hardcoded URL in `core/worker/.../UploadWorker.kt`
- [ ] Fix hardcoded URLs in `app/.../ByteBoxNavHost.kt`
- [ ] Update deep link host in `app/src/main/AndroidManifest.xml`
- [ ] Remove cleartext domains in `app/src/main/res/xml/network_security_config.xml`
- [ ] Generate signing keystore for release APK

## Admin Dashboard
- [ ] Set `VITE_API_URL=https://yourdomain.com/api/v1` in `admin/.env`

## Server Setup
- [ ] Point domain DNS to server IP
- [ ] Configure Nginx reverse proxy
- [ ] Install SSL with Certbot
- [ ] Run database migrations
- [ ] Create systemd service for backend
- [ ] Re-enable rate limiting in code

## Deploy
- [ ] Build and start backend on server
- [ ] Build admin dashboard and serve via Nginx
- [ ] Build release APK
- [ ] Test all features on production

## Optional (add later)
- [ ] Google OAuth credentials
- [ ] Stripe for payments
- [ ] Cloudflare Stream for video
- [ ] Meilisearch for search
- [ ] ClamAV for malware scanning
- [ ] Play Store listing ($25)
