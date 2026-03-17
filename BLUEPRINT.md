# ByteBox — TeraBox-Like Cloud Storage Platform Blueprint

## Context
Building a production-grade cloud storage platform (like TeraBox/MEGA/pCloud) with Android app, scalable backend, object storage, secure auth, file/folder management, media preview, sharing links, resumable uploads/downloads, admin panel, and production deployment. Starting with MVP, scaling to millions of users.

## Chosen Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile | Kotlin + Jetpack Compose | Native performance, best file/background APIs |
| Backend | Go | Excellent concurrency, low memory, fast I/O, single binary |
| Database | PostgreSQL | Best indexing, JSONB, proven at scale |
| Cache | Redis | Caching + queues + sessions + rate limiting |
| Object Storage | Cloudflare R2 | S3-compatible, zero egress fees |
| Search | PostgreSQL full-text (MVP) | No extra infra, upgrade to Meilisearch later |
| Queue | Redis + Asynq | Simple, reliable, Go-native |
| Infra | Docker + VPS | Cost-effective MVP, scale to K8s later |
| Admin | React + Vite | Best ecosystem for dashboards |
| Auth | Custom JWT | Full control, no vendor lock-in |

---

## 1. Product Understanding

### Goal
A cloud storage platform where users can securely store, organize, preview, and share files from their Android devices with resumable upload/download support.

### MVP Features
- Email/password signup + login with JWT
- File upload (single + chunked for large files)
- Folder create/rename/delete/navigate
- File listing with grid/list view
- File download (resumable)
- File preview (images, video, PDF, audio)
- Share files via link (public/password-protected)
- Trash bin with 30-day auto-delete
- Basic storage quota (5GB free)
- Admin panel: user management, storage stats

### Advanced Features (Post-MVP)
- Social login (Google, Apple)
- Premium plans with larger quotas
- Offline mode / favorites
- Background auto-upload (camera roll)
- File versioning
- Team/shared folders
- End-to-end encryption option
- Virus/malware scanning
- Advanced search with filters
- Desktop sync client

---

## 2. Why This Stack Fits

### Go Backend
- **Goroutines** handle thousands of concurrent uploads without thread pool overhead
- **Single binary** deployment — one Docker image, no runtime dependencies
- **Low memory** — a Go server serving files uses ~50MB vs ~300MB+ for JVM
- **stdlib net/http** is production-ready; no heavy framework needed
- **Tradeoff**: Slower initial development vs Python/Node, but pays off at scale

### Cloudflare R2
- **Zero egress fees** — critical for a storage app where users download files constantly
- **S3-compatible API** — use standard AWS SDK, easy migration path
- **Tradeoff**: Fewer features than S3 (no lifecycle transitions to Glacier), but sufficient for MVP

### What to Avoid in MVP
- Kubernetes (use Docker Compose on VPS)
- Microservices (use modular monolith)
- Dedicated search engine (use PostgreSQL full-text)
- Real-time collaboration features
- Desktop/iOS clients
- Complex billing integration

---

## 3. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Android App (Kotlin)                    │
│  Jetpack Compose · Retrofit · Room · WorkManager · Hilt  │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
                ┌──────▼──────┐
                │   Nginx     │  (Reverse proxy, TLS, rate limit)
                │   + CDN     │
                └──────┬──────┘
                       │
          ┌────────────▼────────────────┐
          │     Go API Server           │
          │  (Modular Monolith)         │
          │                             │
          │  ┌─────┐ ┌──────┐ ┌──────┐ │
          │  │Auth │ │File  │ │Upload│ │
          │  │Mod  │ │Mod   │ │Mod   │ │
          │  └─────┘ └──────┘ └──────┘ │
          │  ┌─────┐ ┌──────┐ ┌──────┐ │
          │  │Share│ │Media │ │Admin │ │
          │  │Mod  │ │Mod   │ │Mod   │ │
          │  └─────┘ └──────┘ └──────┘ │
          └──┬────┬────┬───────────────┘
             │    │    │
     ┌───────▼┐ ┌─▼──┐ ┌▼──────────────┐
     │Postgres│ │Redis│ │Cloudflare R2  │
     │  (DB)  │ │Cache│ │(Object Store) │
     │        │ │+Queue│ │              │
     └────────┘ └─────┘ └──────────────┘
          │
    ┌─────▼──────┐
    │ Go Worker  │  (Asynq - thumbnails, cleanup, notifications)
    └────────────┘
```

### Components
- **Nginx**: TLS termination, rate limiting, static file serving, reverse proxy
- **Go API Server**: Handles all REST endpoints, modular internal structure
- **Go Worker**: Background jobs via Asynq (thumbnail gen, trash cleanup, virus scan)
- **PostgreSQL**: Users, files metadata, folders, shares, upload sessions, audit logs
- **Redis**: Session cache, rate limit counters, job queue (Asynq), temp upload state
- **Cloudflare R2**: Actual file blobs, thumbnails, user avatars
- **CDN (Cloudflare)**: Cached public share downloads, thumbnails

---

## 4. End-to-End User Flows

### User Signup/Login
1. User enters email + password → POST `/api/v1/auth/register`
2. Server hashes password (bcrypt), creates user row, generates JWT pair
3. Returns `access_token` (15min) + `refresh_token` (30 days) + user profile
4. App stores tokens in EncryptedSharedPreferences
5. All subsequent requests include `Authorization: Bearer <access_token>`
6. On 401 → app calls POST `/api/v1/auth/refresh` with refresh token

### Upload File (Small < 10MB)
1. App calls POST `/api/v1/files/upload` with multipart form data
2. Server streams file to R2, creates file metadata in PostgreSQL
3. Returns file metadata (id, name, size, mime, thumbnail URL)
4. Worker generates thumbnail asynchronously

### Upload File (Large — Chunked/Resumable)
1. App calls POST `/api/v1/uploads/init` with `{filename, size, mime, folder_id, chunk_size}`
2. Server creates `upload_sessions` row, returns `upload_id` + presigned URLs for each chunk
3. App uploads chunks in parallel (3-5 concurrent) via PUT to presigned R2 URLs
4. After each chunk: App calls POST `/api/v1/uploads/{id}/complete-part` with `{part_number, etag}`
5. After all chunks: App calls POST `/api/v1/uploads/{id}/finalize`
6. Server calls R2 CompleteMultipartUpload, creates file metadata, deletes session
7. On network failure: App calls GET `/api/v1/uploads/{id}/status` to resume from last completed chunk

### File Listing
1. App calls GET `/api/v1/folders/{id}/contents?cursor=xxx&limit=50&sort=name&order=asc`
2. Server returns paginated list of files + subfolders with cursor for next page
3. App caches results in Room DB for offline access

### File Preview
- **Images**: Server generates thumbnail on upload (via worker). App loads via Coil from thumbnail URL
- **Video**: App streams via presigned URL using ExoPlayer. Server generates video thumbnail
- **PDF**: App uses Android PdfRenderer or WebView with presigned URL
- **Audio**: App uses ExoPlayer with presigned URL

### File Download
1. App calls GET `/api/v1/files/{id}/download`
2. Server returns presigned R2 URL (valid 1 hour)
3. App uses DownloadManager or OkHttp with Range header support for resume
4. Progress tracked in Room DB, shown in notification

### Share by Link
1. User taps Share → POST `/api/v1/shares` with `{file_id, password?, expires_at?, max_downloads?}`
2. Server generates unique short code, returns share URL: `https://byteboxapp.com/s/abc123`
3. Anyone with link → GET `/api/v1/shares/{code}` returns file info
4. Download via GET `/api/v1/shares/{code}/download` (checks password, expiry, download count)

### Delete / Restore
1. Delete → POST `/api/v1/files/{id}/trash` — sets `trashed_at`, moves to trash view
2. Restore → POST `/api/v1/files/{id}/restore` — clears `trashed_at`
3. Permanent delete → DELETE `/api/v1/files/{id}` — deletes from R2 + DB
4. Worker job runs daily: permanently deletes files where `trashed_at < now() - 30 days`

### Thumbnail Generation
1. Upload completes → Asynq job `task:generate_thumbnail` enqueued
2. Worker downloads file from R2, generates thumbnail (sharp for images, ffmpeg for video)
3. Uploads thumbnail to R2 at `thumbnails/{user_id}/{file_id}.jpg`
4. Updates file row with `thumbnail_key`

### Virus Scanning (Post-MVP)
1. Upload completes → Asynq job `task:virus_scan` enqueued
2. Worker downloads file, runs ClamAV scan
3. If infected: marks file as quarantined, notifies user
4. If clean: marks `scan_status = clean`

---

## 5. Mobile App Architecture (Kotlin + Jetpack Compose)

### Architecture Pattern: MVVM + Clean Architecture

```
Presentation (Compose UI + ViewModels)
    ↓ depends on
Domain (UseCases, Repository interfaces, Entities)
    ↓ depends on
Data (Repository impls, API service, Room DB, DataStore)
```

### Module Breakdown
```
:app                    — MainActivity, NavGraph, Hilt setup
:core:common            — Result wrapper, extensions, constants
:core:network           — Retrofit client, interceptors, auth token refresh
:core:database          — Room DB, DAOs, entities
:core:datastore         — Proto DataStore for preferences
:core:ui                — Shared Compose components, theme, icons
:core:worker            — WorkManager workers for upload/download
:domain                 — UseCases, repository interfaces, domain models
:feature:auth           — Login, register, forgot password
:feature:files          — File browser, grid/list, folder navigation
:feature:upload         — Upload queue, chunk upload, progress
:feature:download       — Download manager, progress, resume
:feature:preview        — Image/video/PDF/audio preview
:feature:share          — Share dialog, link management
:feature:settings       — Profile, storage usage, preferences
:feature:trash          — Trash bin, restore, permanent delete
```

### Folder Structure (per feature module)
```
feature/files/
├── data/
│   ├── api/FileApi.kt
│   ├── dto/FileDto.kt
│   └── repository/FileRepositoryImpl.kt
├── domain/
│   ├── model/FileItem.kt
│   ├── repository/FileRepository.kt
│   └── usecase/GetFolderContentsUseCase.kt
└── presentation/
    ├── FileListScreen.kt
    ├── FileListViewModel.kt
    └── components/
        ├── FileGridItem.kt
        ├── FileListItem.kt
        └── FolderBreadcrumb.kt
```

### Key Libraries
| Purpose | Library |
|---------|---------|
| Networking | Retrofit + OkHttp + Moshi |
| DI | Hilt |
| Local DB | Room |
| Preferences | Proto DataStore |
| Image loading | Coil |
| Video playback | Media3 (ExoPlayer) |
| Background work | WorkManager |
| Navigation | Compose Navigation (type-safe) |
| File picker | SAF (Storage Access Framework) |
| Encryption | EncryptedSharedPreferences, Tink |

### Offline Support
- Room DB caches file/folder metadata for offline browsing
- DataStore stores user preferences and auth tokens
- Favorited files cached to local storage
- Sync on connectivity restored via WorkManager

### Background Upload/Download
- **Upload**: WorkManager `CoroutineWorker` with `ForegroundInfo` for notification
  - Reads chunk from file, uploads via presigned URL
  - Tracks progress in Room DB
  - On failure: exponential backoff (15s, 30s, 1m, 5m, max 30m)
  - Respects battery/network constraints
- **Download**: Similar WorkManager approach with OkHttp Range requests
  - Resumes from last byte received
  - Writes to app-specific storage, then copies to user location

### Pagination
- Cursor-based pagination (not offset) for consistency during concurrent modifications
- Cursor = encoded `(sort_field_value, id)` tuple
- Load 50 items per page, prefetch next page at 80% scroll position

### Media Preview Strategy
- Thumbnails: loaded from server-generated URLs via Coil (memory + disk cache)
- Full images: loaded from presigned URL via Coil with zoom (telephoto library)
- Video: streamed via presigned URL with Media3 ExoPlayer
- PDF: Android PdfRenderer for local, WebView for streaming
- Audio: Media3 with notification controls

---

## 6. Backend Architecture

### Modular Monolith (MVP)
Single Go binary with clear internal module boundaries. Extract modules to services only when needed.

### Go Project Structure
```
bytebox-api/
├── cmd/
│   ├── server/main.go           # HTTP server
│   ├── worker/main.go           # Asynq worker
│   └── migrate/main.go          # DB migrations
├── internal/
│   ├── auth/
│   │   ├── handler.go           # HTTP handlers
│   │   ├── service.go           # Business logic
│   │   ├── repository.go        # SQL queries
│   │   ├── middleware.go         # JWT middleware
│   │   └── types.go             # Request/response types
│   ├── file/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── types.go
│   ├── folder/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── types.go
│   ├── upload/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── session.go           # Upload session management
│   │   ├── chunker.go           # Chunk validation/merge
│   │   ├── repository.go
│   │   └── types.go
│   ├── share/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── types.go
│   ├── media/
│   │   ├── processor.go         # Thumbnail generation
│   │   └── jobs.go              # Asynq task definitions
│   ├── admin/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   ├── notification/
│   │   ├── service.go
│   │   └── email.go
│   ├── storage/
│   │   ├── r2.go                # R2/S3 client wrapper
│   │   └── presign.go           # Presigned URL generation
│   ├── platform/
│   │   ├── config/config.go     # Env config loading
│   │   ├── database/pg.go       # PostgreSQL connection
│   │   ├── cache/redis.go       # Redis client
│   │   ├── queue/asynq.go       # Asynq client/server
│   │   ├── logger/logger.go     # Structured logging (slog)
│   │   └── middleware/           # CORS, rate limit, request ID
│   └── common/
│       ├── errors.go            # Error types
│       ├── pagination.go        # Cursor pagination helpers
│       └── validator.go         # Input validation
├── migrations/                  # SQL migration files
├── docs/                        # API docs (OpenAPI)
├── scripts/                     # Dev/deploy scripts
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── go.mod
```

### Key Backend Design Decisions

**Router**: `chi` — lightweight, stdlib-compatible, middleware support
**ORM**: `sqlc` — generates type-safe Go from SQL, no runtime overhead
**Migrations**: `golang-migrate` — SQL-based, version-controlled
**Validation**: `go-playground/validator` — struct tag validation
**Config**: `envconfig` or `viper` — env-based config
**Logging**: `slog` (stdlib) — structured JSON logs
**Queue**: `hibiken/asynq` — Redis-based, retries, scheduling, monitoring UI

**REST API Versioning**: URL prefix `/api/v1/` — simple, explicit

**Rate Limiting**: Token bucket per user via Redis
- Auth endpoints: 5 req/min
- Upload init: 10 req/min
- General API: 100 req/min
- Admin: 200 req/min

**Presigned URL Strategy**:
- Upload: server generates presigned PUT URL for each chunk → client uploads directly to R2
- Download: server generates presigned GET URL (1 hour expiry) → client downloads from R2
- Thumbnails: presigned GET with longer expiry (24h) or Cloudflare CDN cached

**Idempotency**:
- Upload chunk completion: idempotent by `(upload_id, part_number)` — re-submitting same part is a no-op
- File creation: client generates `idempotency_key`, server deduplicates within 24h window
- Share creation: idempotent by `(file_id, user_id)` — returns existing share if exists

---

## 7. Database Design

### Entity-Relationship Summary
```
users 1──N files
users 1──N folders
folders 1──N files
folders 1──N folders (parent)
users 1──N upload_sessions
files 1──N shares
users 1──N devices
users 1──N sessions
users 1──1 storage_quotas
```

### Tables

#### users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    avatar_key      VARCHAR(500),          -- R2 key
    storage_used    BIGINT DEFAULT 0,      -- bytes
    storage_limit   BIGINT DEFAULT 5368709120, -- 5GB default
    plan            VARCHAR(20) DEFAULT 'free', -- free, pro, premium
    is_active       BOOLEAN DEFAULT true,
    is_admin        BOOLEAN DEFAULT false,
    email_verified  BOOLEAN DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

#### folders
```sql
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    parent_id       UUID REFERENCES folders(id),  -- NULL = root
    name            VARCHAR(255) NOT NULL,
    path            TEXT NOT NULL,                  -- materialized path: /root/docs/photos
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, parent_id, name) WHERE trashed_at IS NULL
);
CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id) WHERE trashed_at IS NULL;
CREATE INDEX idx_folders_trashed ON folders(user_id, trashed_at) WHERE trashed_at IS NOT NULL;
```

#### files
```sql
CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    folder_id       UUID REFERENCES folders(id),   -- NULL = root
    name            VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,          -- R2 object key
    thumbnail_key   VARCHAR(500),                   -- R2 thumbnail key
    size            BIGINT NOT NULL,                -- bytes
    mime_type       VARCHAR(100) NOT NULL,
    content_hash    VARCHAR(64),                    -- SHA-256 for dedup
    scan_status     VARCHAR(20) DEFAULT 'pending',  -- pending, clean, infected
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, folder_id, name) WHERE trashed_at IS NULL
);
CREATE INDEX idx_files_user_folder ON files(user_id, folder_id) WHERE trashed_at IS NULL;
CREATE INDEX idx_files_trashed ON files(user_id, trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX idx_files_content_hash ON files(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_files_search ON files USING gin(to_tsvector('english', name));
```

#### upload_sessions
```sql
CREATE TABLE upload_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    folder_id       UUID REFERENCES folders(id),
    filename        VARCHAR(255) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    chunk_size      INTEGER NOT NULL,             -- bytes per chunk
    total_chunks    INTEGER NOT NULL,
    completed_chunks INTEGER DEFAULT 0,
    r2_upload_id    VARCHAR(500),                 -- R2 multipart upload ID
    status          VARCHAR(20) DEFAULT 'active', -- active, finalizing, completed, cancelled, expired
    expires_at      TIMESTAMPTZ NOT NULL,         -- auto-expire after 24h
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id, status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at) WHERE status = 'active';
```

#### upload_parts
```sql
CREATE TABLE upload_parts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    part_number     INTEGER NOT NULL,
    etag            VARCHAR(255) NOT NULL,
    size            BIGINT NOT NULL,
    checksum        VARCHAR(64),                 -- MD5 or SHA-256
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, part_number)
);
```

#### shares
```sql
CREATE TABLE shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id         UUID NOT NULL REFERENCES files(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    code            VARCHAR(12) UNIQUE NOT NULL,  -- short URL code
    password_hash   VARCHAR(255),                 -- optional password
    expires_at      TIMESTAMPTZ,                  -- optional expiry
    max_downloads   INTEGER,                      -- optional limit
    download_count  INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shares_code ON shares(code) WHERE is_active = true;
CREATE INDEX idx_shares_file ON shares(file_id);
```

#### sessions (auth)
```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    refresh_token   VARCHAR(500) UNIQUE NOT NULL,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),                  -- android, web, admin
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,         -- file.upload, file.delete, share.create, etc.
    resource_type   VARCHAR(50),                  -- file, folder, share, user
    resource_id     UUID,
    metadata        JSONB,                        -- extra context
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
-- Partition by month for large scale:
-- CREATE TABLE audit_logs (...) PARTITION BY RANGE (created_at);
```

### Soft Delete / Trash Design
- `trashed_at TIMESTAMPTZ` field on files and folders (NULL = not trashed)
- Trashing a folder cascades to all contents (recursive CTE)
- Partial unique indexes exclude trashed items from uniqueness constraints
- Daily Asynq job: `DELETE FROM files WHERE trashed_at < NOW() - INTERVAL '30 days'` + delete R2 objects
- Restore clears `trashed_at` on item and all children

---

## 8. Object Storage Design (Cloudflare R2)

### Bucket Structure
```
bytebox-files             — user files (primary bucket)
bytebox-thumbnails        — generated thumbnails (separate for CDN caching)
bytebox-temp              — temporary chunks during upload (auto-expire lifecycle)
```

### File Key Naming Strategy
```
files/{user_id_prefix}/{user_id}/{file_id}/{original_filename}
```
- `user_id_prefix` = first 2 chars of user_id — prevents hot partition on prefix
- Example: `files/a3/a3f5e7b2-.../8c4d1a9f-.../photo.jpg`

### Thumbnail Keys
```
thumbnails/{user_id}/{file_id}_thumb.jpg
thumbnails/{user_id}/{file_id}_preview.jpg  (larger preview)
```

### Multipart Upload Flow
1. Server calls R2 `CreateMultipartUpload` → gets `uploadId`
2. For each chunk: server generates presigned PUT URL for that part
3. Client uploads chunk directly to R2 using presigned URL
4. Client reports ETag back to server
5. Server calls R2 `CompleteMultipartUpload` with all ETags

### Chunk Sizes
| File Size | Chunk Size | Max Chunks |
|-----------|-----------|------------|
| < 10MB | Single upload (no chunking) | 1 |
| 10MB - 100MB | 5MB | 20 |
| 100MB - 1GB | 10MB | 100 |
| 1GB - 5GB | 25MB | 200 |
| 5GB+ | 50MB | ~200 |

### Encryption
- **In transit**: TLS 1.3 (enforced by Cloudflare)
- **At rest**: R2 encrypts at rest by default (SSE)
- **Client-side** (post-MVP): optional E2E encryption with user-held keys

### Deduplication (Post-MVP)
- SHA-256 content hash stored in `files.content_hash`
- Before upload: check if hash exists for same user → create reference instead of duplicate
- Cross-user dedup is complex (privacy concerns) — defer to post-MVP

### Lifecycle Rules
- `bytebox-temp` bucket: auto-delete objects older than 24h
- Permanently deleted files: R2 objects deleted by worker job

---

## 9. Security Architecture

### JWT Auth Flow
```
Register → bcrypt hash → store user → issue JWT pair
Login → verify bcrypt → issue JWT pair
Access token: 15 min, signed with Ed25519/RS256
Refresh token: 30 days, stored in sessions table, rotated on use
```

### Token Structure
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "plan": "free",
  "iat": 1234567890,
  "exp": 1234568790,
  "jti": "unique_token_id"
}
```

### Security Measures
- **Password**: bcrypt with cost 12, minimum 8 chars
- **Refresh token rotation**: old token invalidated on refresh, detect token reuse
- **Device tracking**: each session tied to device fingerprint
- **Presigned URLs**: 1h expiry for downloads, 2h for upload chunks
- **CORS**: whitelist app domains only
- **Rate limiting**: per-user via Redis token bucket
- **Input validation**: all inputs validated and sanitized
- **SQL injection**: prevented by parameterized queries (sqlc)
- **File validation**: check MIME type matches extension, max file size per plan
- **CSP/Security headers**: Helmet-equivalent middleware for admin panel
- **Brute force**: account lockout after 5 failed login attempts (15 min cooldown)

### Abuse Prevention
- Storage quota enforcement (check before upload)
- Rate limit on share link creation
- CAPTCHA on registration (hCaptcha)
- Report abuse mechanism on shared links
- Block known malicious file types (.exe, .bat on free tier)

---

## 10. API Design

### Auth — `/api/v1/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | /register | Create account (email, password, display_name) |
| POST | /login | Login, returns JWT pair |
| POST | /refresh | Refresh access token |
| POST | /logout | Invalidate refresh token |
| POST | /forgot-password | Send password reset email |
| POST | /reset-password | Reset password with token |
| GET | /me | Get current user profile |
| PUT | /me | Update profile (display_name, avatar) |
| POST | /change-password | Change password (requires old password) |

### Files — `/api/v1/files`
| Method | Path | Description |
|--------|------|-------------|
| POST | /upload | Simple upload (< 10MB, multipart form) |
| GET | /{id} | Get file metadata |
| PUT | /{id} | Rename file |
| POST | /{id}/copy | Copy file to another folder |
| POST | /{id}/move | Move file to another folder |
| POST | /{id}/trash | Move to trash |
| POST | /{id}/restore | Restore from trash |
| DELETE | /{id} | Permanently delete |
| GET | /{id}/download | Get presigned download URL |

### Folders — `/api/v1/folders`
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create folder |
| GET | /{id}/contents | List folder contents (paginated, sorted) |
| PUT | /{id} | Rename folder |
| POST | /{id}/move | Move folder |
| POST | /{id}/trash | Trash folder + contents |
| POST | /{id}/restore | Restore folder + contents |
| DELETE | /{id} | Permanently delete folder + contents |

### Uploads — `/api/v1/uploads` (chunked)
| Method | Path | Description |
|--------|------|-------------|
| POST | /init | Initialize chunked upload, returns upload_id + presigned URLs |
| GET | /{id}/status | Get upload session status (completed chunks) |
| POST | /{id}/complete-part | Report completed chunk (part_number, etag) |
| POST | /{id}/finalize | Finalize upload, merge chunks |
| POST | /{id}/cancel | Cancel and cleanup upload |

### Shares — `/api/v1/shares`
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create share link for file |
| GET | / | List user's active shares |
| GET | /{code} | Get share info (public) |
| GET | /{code}/download | Download shared file (public) |
| PUT | /{id} | Update share (password, expiry) |
| DELETE | /{id} | Revoke share link |

### Search — `/api/v1/search`
| Method | Path | Description |
|--------|------|-------------|
| GET | /files?q=term | Search files by name |

### Users/Account — `/api/v1/users`
| Method | Path | Description |
|--------|------|-------------|
| GET | /me/storage | Get storage usage breakdown |
| GET | /me/sessions | List active sessions/devices |
| DELETE | /me/sessions/{id} | Revoke a session |
| GET | /me/trash | List trashed items |

### Admin — `/api/v1/admin`
| Method | Path | Description |
|--------|------|-------------|
| GET | /dashboard | System stats (users, storage, uploads) |
| GET | /users | List all users (paginated, filterable) |
| GET | /users/{id} | User detail + storage usage |
| PUT | /users/{id} | Update user (plan, quota, active status) |
| POST | /users/{id}/ban | Ban user |
| GET | /files | Browse all files (admin) |
| DELETE | /files/{id} | Admin delete file |
| GET | /audit-logs | Query audit logs |
| GET | /storage/stats | Storage analytics |

---

## 11. Upload/Download Subsystem (Deep Dive)

### Chunk Upload Protocol

#### 1. Initialize
```
POST /api/v1/uploads/init
Body: { filename, file_size, mime_type, folder_id, content_hash? }
Response: {
  upload_id,
  chunk_size,          // server decides based on file_size
  total_chunks,
  presigned_urls: [    // one per chunk
    { part_number: 1, url: "https://r2...", expires_at: "..." },
    { part_number: 2, url: "https://r2...", expires_at: "..." },
    ...
  ]
}
```

#### 2. Upload Chunks (Client-Side)
- Upload 3-5 chunks in parallel
- Each chunk: PUT to presigned URL with chunk data
- R2 returns ETag in response header
- Client reports completion: `POST /uploads/{id}/complete-part { part_number, etag, checksum }`

#### 3. Resume After Failure
- Client calls `GET /uploads/{id}/status`
- Response includes list of completed part numbers
- Client resumes from first missing chunk
- If presigned URLs expired: `POST /uploads/{id}/refresh-urls` generates new ones

#### 4. Finalize
```
POST /api/v1/uploads/{id}/finalize
Server:
  1. Validates all chunks completed
  2. Calls R2 CompleteMultipartUpload
  3. Creates file record in DB
  4. Updates user storage_used
  5. Enqueues thumbnail generation job
  6. Deletes upload session
  7. Returns file metadata
```

#### 5. Cancellation
```
POST /api/v1/uploads/{id}/cancel
Server:
  1. Calls R2 AbortMultipartUpload
  2. Marks session as cancelled
  3. Cleanup job deletes any orphaned parts
```

#### 6. Expiry
- Upload sessions expire after 24 hours
- Asynq cron job: find expired sessions → abort R2 multipart → delete session
- `bytebox-temp` bucket lifecycle also cleans orphaned objects

### Checksum Validation
- Per-chunk: client sends MD5, server verifies against R2 ETag
- Whole-file (optional): client sends SHA-256 before upload, server verifies after finalize
- Mismatch → reject and require re-upload of that chunk

### Android Background Constraints
- Use WorkManager for chunked uploads (survives app death)
- `ForegroundService` with notification for active transfers
- Respect `CONSTRAINT_NETWORK_TYPE` (WiFi only option)
- Respect battery optimization (don't upload on low battery)
- On Android 12+: `setExpedited()` for user-initiated uploads
- Keep `wake_lock` during active chunk upload only

### Download Strategy
- Server returns presigned GET URL with `Content-Disposition: attachment`
- Client uses OkHttp with `Range` header for resume
- Track downloaded bytes in Room DB
- On resume: `Range: bytes={downloaded}-` header
- WorkManager for background downloads
- Notification with progress bar

---

## 12. Scalability Plan

### 1,000 Users (MVP)
- **1 VPS** (4 vCPU, 8GB RAM, ~$40/mo)
- Single Go binary + PostgreSQL + Redis on same VPS
- Cloudflare R2 for storage
- Docker Compose for orchestration
- Estimated storage: ~1TB (1000 users x 1GB avg)
- R2 cost: ~$15/mo for 1TB

### 100,000 Users
- **3-5 VPS instances** behind load balancer
- Separate DB server (managed PostgreSQL or dedicated VPS)
- Redis on dedicated VPS or managed service
- **Add**: PostgreSQL read replica for queries
- **Add**: CDN (Cloudflare) for thumbnails and public shares
- **Add**: Separate worker VPS for background jobs
- Connection pooling with PgBouncer
- Estimated storage: ~100TB → R2: ~$1,500/mo

### 1,000,000+ Users
- **Kubernetes** cluster (managed EKS/GKE)
- PostgreSQL with read replicas + connection pooling
- Consider table partitioning (files by user_id range, audit_logs by date)
- Redis Cluster for caching
- Dedicated worker pool (auto-scaled)
- Add Meilisearch for file search
- CDN for all static assets + thumbnails
- Consider multi-region deployment
- Estimated storage: ~1PB → R2: ~$15,000/mo

---

## 13. DevOps and Deployment

### Local Development
```yaml
# docker-compose.dev.yml
services:
  api:
    build: .
    ports: ["8080:8080"]
    env_file: .env.local
    volumes: ["./:/app"]     # hot reload with air
    depends_on: [postgres, redis, minio]
  worker:
    build: .
    command: ["./worker"]
    env_file: .env.local
    depends_on: [postgres, redis, minio]
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  minio:                     # S3-compatible for local dev
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
  admin:
    build: ./admin
    ports: ["3000:3000"]
```

### Production Setup
- **VPS provider**: Hetzner (best price/performance) or DigitalOcean
- **Nginx** in front: TLS termination, rate limiting, gzip
- **Docker Compose** for production orchestration (MVP)
- **Cloudflare** for DNS + CDN + DDoS protection
- **R2** for object storage

### CI/CD Pipeline (GitHub Actions)
```
on push to main:
  1. Run tests (go test ./...)
  2. Run linter (golangci-lint)
  3. Build Docker image
  4. Push to container registry (GitHub Packages or Docker Hub)
  5. SSH deploy to VPS: pull image, docker compose up -d
  6. Run DB migrations
  7. Health check
  8. Notify (Slack/Discord)
```

### Secrets Management
- `.env` files (never committed)
- Docker secrets for production
- Consider Vault at scale

### Monitoring & Logging
| Tool | Purpose |
|------|---------|
| Prometheus | Metrics collection (API latency, upload rates, error rates) |
| Grafana | Dashboards and visualization |
| Loki | Log aggregation (or just structured JSON logs to files) |
| Alertmanager | Alert on error spikes, disk usage, failed jobs |
| Uptime Robot | External health check |
| Asynq Monitor | Job queue dashboard |

### Backups
- PostgreSQL: daily `pg_dump` to R2, retain 30 days
- Redis: RDB snapshots (data is ephemeral/cacheable, less critical)
- Test restores monthly

### Disaster Recovery
- DB point-in-time recovery via WAL archiving
- R2 has built-in redundancy (11 nines durability)
- Runbook for: DB restore, service failover, R2 access issues

---

## 14. Recommended Libraries/Tools

### Go Backend
| Purpose | Library |
|---------|---------|
| Router | `go-chi/chi` |
| SQL codegen | `sqlc` |
| Migrations | `golang-migrate` |
| Validation | `go-playground/validator` |
| JWT | `golang-jwt/jwt` |
| S3/R2 client | `aws-sdk-go-v2` |
| Queue | `hibiken/asynq` |
| Config | `kelseyhightower/envconfig` |
| Logging | `log/slog` (stdlib) |
| Testing | `stretchr/testify` + `DATA-DOG/go-sqlmock` |
| HTTP client | `net/http` (stdlib) |
| UUID | `google/uuid` |
| Password | `golang.org/x/crypto/bcrypt` |
| Image processing | `disintegration/imaging` |
| FFmpeg (video thumbs) | Shell exec or `u2takey/ffmpeg-go` |

### Android (Kotlin)
| Purpose | Library |
|---------|---------|
| HTTP | Retrofit + OkHttp + Moshi |
| DI | Hilt |
| DB | Room |
| Preferences | Proto DataStore |
| Images | Coil |
| Video | Media3 (ExoPlayer) |
| Background | WorkManager |
| Navigation | Compose Navigation |
| Coroutines | kotlinx-coroutines |
| Encryption | Tink / EncryptedSharedPreferences |

### Admin Panel (React)
| Purpose | Library |
|---------|---------|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| State | React Query (TanStack) + Zustand |
| UI | Ant Design or Shadcn/ui |
| Charts | Recharts |
| HTTP | Axios |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Auth | Custom JWT with Axios interceptors |

---

## 15. Project Structure

### Full Repository Layout
```
bytebox/
├── android/                     # Android app (Kotlin)
│   ├── app/
│   ├── core/
│   │   ├── common/
│   │   ├── network/
│   │   ├── database/
│   │   ├── datastore/
│   │   ├── ui/
│   │   └── worker/
│   ├── domain/
│   ├── feature/
│   │   ├── auth/
│   │   ├── files/
│   │   ├── upload/
│   │   ├── download/
│   │   ├── preview/
│   │   ├── share/
│   │   ├── trash/
│   │   └── settings/
│   ├── build.gradle.kts
│   └── settings.gradle.kts
│
├── backend/                     # Go API + Worker
│   ├── cmd/
│   │   ├── server/
│   │   └── worker/
│   ├── internal/
│   │   ├── auth/
│   │   ├── file/
│   │   ├── folder/
│   │   ├── upload/
│   │   ├── share/
│   │   ├── media/
│   │   ├── admin/
│   │   ├── notification/
│   │   ├── storage/
│   │   ├── platform/
│   │   └── common/
│   ├── migrations/
│   ├── docs/
│   ├── Dockerfile
│   ├── Makefile
│   └── go.mod
│
├── admin/                       # React admin panel
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── Users/
│   │   │   ├── Files/
│   │   │   ├── Storage/
│   │   │   ├── AuditLogs/
│   │   │   └── Settings/
│   │   ├── store/
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── infra/                       # Infrastructure
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── nginx/
│   │   └── nginx.conf
│   ├── scripts/
│   │   ├── deploy.sh
│   │   ├── backup.sh
│   │   └── setup-server.sh
│   └── monitoring/
│       ├── prometheus.yml
│       └── grafana/
│
├── .github/
│   └── workflows/
│       ├── backend.yml
│       ├── android.yml
│       └── admin.yml
│
└── README.md
```

---

## 16. Development Roadmap

### Phase 1: MVP (8-10 weeks)
**Deliverables:**
- User registration/login with JWT
- Simple file upload (< 10MB) and download
- Folder CRUD (create, rename, delete, navigate)
- File listing with pagination
- Basic file preview (images)
- Trash with restore
- 5GB free storage quota
- Basic admin panel (user list, storage stats)
- Docker Compose deployment on single VPS

**Dependencies:** PostgreSQL schema, R2 bucket setup, VPS provisioning
**Risks:** Upload reliability on slow networks, R2 SDK compatibility

### Phase 2: Stable Beta (6-8 weeks)
**Deliverables:**
- Chunked/resumable upload for large files
- Share by link (with password + expiry)
- Video/PDF/audio preview
- Thumbnail generation (images + video)
- File search (PostgreSQL full-text)
- Background upload/download with WorkManager
- Session/device management
- Email notifications (welcome, password reset)
- Audit logging

**Dependencies:** Phase 1 complete, Asynq worker pipeline
**Risks:** Chunk upload edge cases, media processing reliability

### Phase 3: Scale & Optimization (6-8 weeks)
**Deliverables:**
- CDN integration for thumbnails + public shares
- Prometheus + Grafana monitoring
- CI/CD pipeline (GitHub Actions)
- Rate limiting + abuse prevention
- Performance optimization (DB indexes, query optimization, caching)
- Move to multiple VPS + load balancer
- PostgreSQL read replica
- Admin panel: audit logs viewer, storage analytics, user management tools
- Android: offline mode for favorites

**Dependencies:** Phase 2 complete, monitoring infrastructure
**Risks:** Migration complexity, performance bottlenecks at scale

### Phase 4: Premium & Advanced (Ongoing)
**Deliverables:**
- Premium plans (Pro: 100GB, Premium: 1TB)
- Payment integration (Stripe / Google Play billing)
- Social login (Google)
- File versioning
- Advanced sharing (folder shares, team folders)
- Auto camera backup
- Advanced search (Meilisearch)
- Virus scanning (ClamAV)
- iOS app (if demand exists)
- Desktop sync client

**Dependencies:** Phase 3 complete, payment provider setup
**Risks:** Billing edge cases, cross-platform sync complexity

---

## 17. Team Recommendation

### Solo Founder
- You do everything: backend (Go), Android (Kotlin), admin (React)
- Focus: ship MVP in 10-12 weeks
- Tip: use sqlc + chi to move fast in Go, use Ant Design for admin to avoid custom UI work
- Biggest risk: burnout — keep scope tight

### Small Startup (3-5 people)
- 1 Backend engineer (Go)
- 1 Android engineer (Kotlin)
- 1 Full-stack (admin panel + devops + testing)
- Optional: 1 Designer, 1 PM
- Ship MVP in 6-8 weeks

### Larger Team (8+)
- 2 Backend engineers
- 2 Android engineers
- 1 Frontend engineer (admin)
- 1 DevOps/SRE
- 1 QA engineer
- 1 Product manager
- Ship MVP in 4-6 weeks, iterate faster

---

## 18. Cost Awareness (MVP)

### Monthly Cost Estimate (1,000 users)
| Service | Cost |
|---------|------|
| VPS (Hetzner CX31) | $15/mo |
| Cloudflare R2 (1TB) | $15/mo |
| Cloudflare (free tier) | $0 |
| Domain | $1/mo |
| **Total** | **~$31/mo** |

### Cost-Saving Tips
- **Use Hetzner** over AWS/GCP for VPS — 3-5x cheaper for same specs
- **Cloudflare R2** — zero egress fees saves hundreds/thousands vs S3
- **Skip Kubernetes** until 100k+ users — Docker Compose is fine
- **Skip dedicated search** — PostgreSQL full-text search is free and sufficient for MVP
- **Skip managed databases** — run PostgreSQL on VPS for MVP (~$0 extra)
- **Use free Cloudflare tier** for CDN and DDoS protection
- **Defer video processing** — generate thumbnails only for images in MVP
- **Asynq monitoring** is free (built-in web UI)
- **GitHub Actions** — free for public repos, 2000 min/mo for private

### What NOT to Compromise
- **Security**: JWT implementation, password hashing, presigned URLs — do it right from day 1
- **Data integrity**: proper DB constraints, foreign keys, checksums
- **Backups**: daily `pg_dump` is cheap and critical
- **TLS**: always HTTPS, use Cloudflare for free certs

---

## 19. Final Recommendation

### Best Architecture for This Stack
**Go modular monolith + PostgreSQL + R2 + Redis** is the optimal choice. Go's concurrency model handles file I/O operations exceptionally well, R2's zero egress fees make this economically viable, and PostgreSQL provides the reliability needed for file metadata.

### Simplest MVP Path
1. Single Go binary with chi router + sqlc
2. PostgreSQL + Redis on same VPS
3. Cloudflare R2 for storage
4. Simple upload first (no chunking), add chunking in Phase 2
5. Ant Design admin panel (fast to build)
6. Deploy with Docker Compose on Hetzner VPS
7. Focus on: auth → upload → download → folders → share → admin

### Most Scalable Long-Term Path
1. Extract upload service first (heaviest load)
2. Add read replicas + PgBouncer at 50k users
3. CDN for all thumbnails and public shares
4. Move to Kubernetes at 100k+ users
5. Add Meilisearch for search at 200k+ users
6. Consider multi-region at 500k+ users
7. The modular monolith makes extraction clean — each internal module becomes a service

---

## Verification Plan
- **Backend**: `go test ./...` for unit tests, integration tests with test PostgreSQL
- **Android**: Run on emulator + physical device, test upload/download on slow network
- **Admin**: Manual testing of all CRUD operations
- **End-to-end**: Register → Upload file → List files → Preview → Share → Download via share link → Trash → Restore
- **Load test**: Use `k6` to test 100 concurrent uploads
- **Security**: Test JWT expiry, refresh rotation, presigned URL expiry, SQL injection attempts
