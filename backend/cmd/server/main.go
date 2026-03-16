package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bytebox/backend/internal/admin"
	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/billing"
	"github.com/bytebox/backend/internal/file"
	"github.com/bytebox/backend/internal/folder"
	"github.com/bytebox/backend/internal/media"
	"github.com/bytebox/backend/internal/platform/cache"
	"github.com/bytebox/backend/internal/platform/config"
	"github.com/bytebox/backend/internal/platform/database"
	"github.com/bytebox/backend/internal/platform/logger"
	"github.com/bytebox/backend/internal/platform/middleware"
	"github.com/bytebox/backend/internal/quota"
	"github.com/bytebox/backend/internal/backup"
	"github.com/bytebox/backend/internal/search"
	"github.com/bytebox/backend/internal/storage"
	"github.com/bytebox/backend/internal/share"
	"github.com/bytebox/backend/internal/upload"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	logger.Setup(cfg.App.Environment)

	slog.Info("starting bytebox server",
		"env", cfg.App.Environment,
		"port", cfg.Server.Port,
	)

	// Database
	db, err := database.New(cfg.Database)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Redis
	rdb, err := cache.New(cfg.Redis)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	defer rdb.Close()

	// Object storage
	store, err := storage.New(cfg.Storage)
	if err != nil {
		slog.Error("failed to connect to storage", "error", err)
		os.Exit(1)
	}

	// Cloudflare Stream client (optional)
	var streamClient *storage.StreamClient
	if cfg.CFStream.Enabled() {
		streamClient = storage.NewStreamClient(cfg.CFStream)
		slog.Info("cloudflare stream client initialized")
	}

	// Asynq client (for enqueuing background tasks)
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr: cfg.Redis.Addr(), Password: cfg.Redis.Password, DB: cfg.Redis.DB,
	})
	defer asynqClient.Close()

	// Auth module
	jwtManager := auth.NewJWTManager(cfg.Auth)
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo, jwtManager, cfg.App, cfg.Auth, cfg.Google.ClientID)
	authMiddleware := auth.NewMiddleware(jwtManager)
	authHandler := auth.NewHandler(authService, authMiddleware)

	// Folder module
	folderRepo := folder.NewRepository(db)
	folderService := folder.NewService(folderRepo, store)
	folderHandler := folder.NewHandler(folderService)

	// Quota module
	quotaService := quota.NewService(db)

	// File module
	fileRepo := file.NewRepository(db)
	fileService := file.NewService(fileRepo, store, streamClient, quotaService, asynqClient, cfg.App.MaxUploadSize)
	fileHandler := file.NewHandler(fileService, cfg.App.MaxUploadSize)

	// Upload module
	uploadRepo := upload.NewRepository(db)
	uploadService := upload.NewService(uploadRepo, fileRepo, store, quotaService, asynqClient)
	uploadHandler := upload.NewHandler(uploadService)

	// Share module
	shareRepo := share.NewRepository(db)
	shareService := share.NewService(shareRepo, fileRepo, folderRepo, store, cfg.App.BaseURL)
	shareHandler := share.NewHandler(shareService)

	// Backup module
	backupRepo := backup.NewRepository(db)
	backupService := backup.NewService(backupRepo)
	backupHandler := backup.NewHandler(backupService)

	// Search module (Meilisearch)
	var searchHandler *search.Handler
	if cfg.Meilisearch.Host != "" {
		meiliClient, err := search.NewMeiliClient(cfg.Meilisearch.Host, cfg.Meilisearch.APIKey)
		if err != nil {
			slog.Error("failed to connect to meilisearch", "error", err)
			os.Exit(1)
		}
		searchHandler = search.NewHandler(meiliClient)
	}

	// Billing module
	billing.SetStripePriceIDs(cfg.Stripe.ProPriceID, cfg.Stripe.PremiumPriceID)
	billingRepo := billing.NewRepository(db)
	billingService := billing.NewService(billingRepo, cfg.Stripe.SecretKey, cfg.Stripe.WebhookSecret, cfg.App.BaseURL)
	billingHandler := billing.NewHandler(billingService, authMiddleware)

	// Admin module
	adminRepo := admin.NewRepository(db)
	adminHandler := admin.NewHandler(adminRepo, quotaService)

	// Rate limiter
	rateLimiter := middleware.NewRateLimiter(rdb)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.CORS([]string{"*"})) // TODO: restrict in production
	r.Use(middleware.Metrics)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Compress(5))

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Auth routes: 5 req/min by IP
		r.Group(func(r chi.Router) {
			r.Use(rateLimiter.Limit(5, time.Minute, middleware.ByIP))
			r.Mount("/auth", authHandler.Routes())
		})

		// Public share routes: 30 req/min by IP
		r.Group(func(r chi.Router) {
			r.Use(rateLimiter.Limit(30, time.Minute, middleware.ByIP))
			r.Mount("/s", shareHandler.PublicRoutes())
		})

		// Protected routes: 100 req/min by user
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Authenticate)
			r.Use(rateLimiter.Limit(100, time.Minute, middleware.ByUserOrIP))
			r.Mount("/folders", folderHandler.Routes())
			r.Mount("/files", fileHandler.Routes())
			r.Mount("/shares", shareHandler.Routes())
			r.Mount("/backup", backupHandler.Routes())
			if searchHandler != nil {
				r.Mount("/search", searchHandler.Routes())
			}
		})

		// Upload routes: 10 req/min by user
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Authenticate)
			r.Use(rateLimiter.Limit(10, time.Minute, middleware.ByUserOrIP))
			r.Mount("/uploads", uploadHandler.Routes())
		})

		// Billing routes: 20 req/min by IP (has own auth for protected routes)
		r.Group(func(r chi.Router) {
			r.Use(rateLimiter.Limit(20, time.Minute, middleware.ByIP))
			r.Mount("/billing", billingHandler.Routes())
		})

		// Admin routes: 200 req/min
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Authenticate)
			r.Use(authMiddleware.RequireAdmin)
			r.Use(rateLimiter.Limit(200, time.Minute, middleware.ByUserOrIP))
			r.Mount("/admin", adminHandler.Routes())
		})

		// Webhook routes (no auth, validated by signature)
		if streamClient != nil {
			webhookHandler := media.NewWebhookHandler(db, streamClient, cfg.CFStream.WebhookSecret)
			r.Post("/webhooks/cloudflare-stream", webhookHandler.Handle)
		}
	})

	// Server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Graceful shutdown
	go func() {
		slog.Info("server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutting down server", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
