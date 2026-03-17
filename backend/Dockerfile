# Build stage
FROM golang:1.24-alpine AS builder

ENV GOTOOLCHAIN=auto

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /worker ./cmd/worker

# Install migrate CLI
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata curl

WORKDIR /app

COPY --from=builder /server .
COPY --from=builder /worker .
COPY --from=builder /go/bin/migrate /usr/local/bin/migrate
COPY migrations/ ./migrations/

EXPOSE 8080

CMD ["./server"]
