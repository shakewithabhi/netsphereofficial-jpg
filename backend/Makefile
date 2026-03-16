.PHONY: build run worker test lint migrate-up migrate-down docker-up docker-down

# Build
build:
	go build -o bin/server ./cmd/server
	go build -o bin/worker ./cmd/worker

# Run
run:
	go run ./cmd/server

worker:
	go run ./cmd/worker

# Test
test:
	go test ./... -v -race

lint:
	golangci-lint run

# Database migrations
DB_URL ?= postgres://bytebox:bytebox@localhost:5432/bytebox?sslmode=disable

migrate-up:
	migrate -path migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path migrations -database "$(DB_URL)" down 1

migrate-create:
	migrate create -ext sql -dir migrations -seq $(name)

# Docker
docker-up:
	docker compose -f ../infra/docker-compose.dev.yml up -d

docker-down:
	docker compose -f ../infra/docker-compose.dev.yml down

# Dev (with hot reload)
dev:
	air -c .air.toml
