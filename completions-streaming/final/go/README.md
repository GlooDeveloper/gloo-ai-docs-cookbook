# Streaming AI Responses in Real Time — Go

Go implementation of real-time SSE streaming with the Gloo AI completions API.

## Setup

```bash
go mod download
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
go run main.go
```

## Proxy server (Track B)

```bash
go run cmd/proxy/main.go
# or build first: go build ./... && ./completions-streaming-proxy
```

## Structure

```
go/
├── main.go                        # Entry point
├── pkg/
│   ├── auth/token.go              # OAuth2 token management
│   ├── streaming/client.go        # SSE parsing + accumulation
│   ├── browser/renderer.go        # Typing-effect CLI demo
│   └── proxy/server.go            # net/http SSE proxy with http.Flusher
├── go.mod
└── go.sum
```
