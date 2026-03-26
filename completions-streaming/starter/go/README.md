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

## Proxy server

```bash
go run cmd/proxy/main.go
# or build first: go build ./... && ./completions-streaming-proxy
```

Once running, send requests to `http://localhost:3001/api/stream` — the proxy relays them to the Gloo AI API and streams the SSE response back to the caller.

```bash
# Minimal request — streams the response as SSE to your terminal
curl -X POST http://localhost:3001/api/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}], "auto_routing": true}'

# With a system prompt
curl -X POST http://localhost:3001/api/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What does it mean to be human?"}
    ],
    "auto_routing": true
  }'
```

Each response line is an SSE event (`data: {...}`). The final chunk has `"finish_reason": "stop"` (or another stop reason) rather than `null`.


## Browser demo

The browser demo is a standalone HTML file shared across all languages — it is not part of this project. With the proxy server running, open `../../frontend-example/index.html` directly in a browser, or serve it:

```bash
npx serve ../../frontend-example
```

## Checkpoint Validation

All checkpoint scripts are standalone — no test framework needed. Each script
makes real API calls and prints `✓`/`✅` on success or `❌` with hints on failure.

**Important:** All commands must be run from `final/go/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
go run tests/step1_auth.go

# CP2: Error handling — 401/403/429 raise correct errors, bad credentials caught
go run tests/step2_error_handling.go

# CP3: Streaming request + SSE parsing — connection opens, stream terminates cleanly
go run tests/step3_sse_parsing.go

# CP4: Token extraction + accumulation — delta content extracted, full response assembled
go run tests/step4_accumulation.go

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
go run tests/step5_renderer.go

# CP6: Proxy server — starts in a goroutine, relays SSE, CORS headers present
go run tests/step6_proxy.go
```

CP6 starts the Go proxy automatically in a goroutine — you do not need to
start the proxy manually before running it.

## Structure

```
go/
├── main.go                        # Entry point
├── cmd/
│   └── proxy/main.go              # Proxy server entry point
├── pkg/
│   ├── auth/token.go              # OAuth2 token management
│   ├── streaming/client.go        # SSE parsing + accumulation
│   ├── browser/renderer.go        # Typing-effect CLI demo
│   └── proxy/server.go            # net/http SSE proxy with http.Flusher
├── go.mod
└── go.sum
```
