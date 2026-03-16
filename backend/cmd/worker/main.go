package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"

	"github.com/bytebox/backend/internal/media"
	"github.com/bytebox/backend/internal/platform/config"
	"github.com/bytebox/backend/internal/platform/database"
	"github.com/bytebox/backend/internal/platform/logger"
	"github.com/bytebox/backend/internal/scanner"
	"github.com/bytebox/backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	logger.Setup(cfg.App.Environment)

	slog.Info("starting bytebox worker",
		"env", cfg.App.Environment,
		"redis", cfg.Redis.Addr(),
	)

	// Database
	db, err := database.New(cfg.Database)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

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

	// ClamAV scanner
	clamav := scanner.NewClamAVScanner(cfg.Scanner.ClamAVEnabled)

	// Media processor
	processor := media.NewProcessor(db, store, streamClient, clamav)

	// Asynq server
	redisOpt := asynq.RedisClientOpt{Addr: cfg.Redis.Addr(), Password: cfg.Redis.Password, DB: cfg.Redis.DB}

	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 10,
		Queues: map[string]int{
			"critical": 6,
			"default":  3,
			"low":      1,
		},
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc(media.TaskGenerateThumbnail, processor.HandleGenerateThumbnail)
	mux.HandleFunc(media.TaskCleanupTrash, processor.HandleCleanupTrash)
	mux.HandleFunc(media.TaskExpireUploads, processor.HandleExpireUploads)
	mux.HandleFunc(media.TaskVirusScan, processor.HandleVirusScan)
	mux.HandleFunc(media.TaskTranscodeVideo, processor.HandleTranscodeVideo)

	// Asynq scheduler for periodic tasks
	scheduler := asynq.NewScheduler(redisOpt, nil)
	scheduler.Register("0 3 * * *", media.NewCleanupTrashTask())   // trash cleanup daily 3 AM
	scheduler.Register("0 * * * *", media.NewExpireUploadsTask())   // expire uploads hourly

	go func() {
		if err := scheduler.Run(); err != nil {
			slog.Error("scheduler error", "error", err)
		}
	}()

	go func() {
		if err := srv.Run(mux); err != nil {
			slog.Error("worker error", "error", err)
			os.Exit(1)
		}
	}()

	slog.Info("worker started")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down worker")
	scheduler.Shutdown()
	srv.Shutdown()
	slog.Info("worker stopped")
}
