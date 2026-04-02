# Streaming AI Responses in Real Time — PHP

PHP implementation of real-time SSE streaming with the Gloo AI completions API.

## Setup

```bash
composer install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
composer start
# or: php src/index.php
```

## Proxy server

```bash
composer proxy
# or: php -S localhost:3001 src/Proxy/Server.php
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

**Important:** All commands must be run from `final/php/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
php tests/Step1AuthTest.php

# CP2: Error handling — 401/403/429 raise correct errors, bad credentials caught
php tests/Step2ErrorHandlingTest.php

# CP3: Streaming request + SSE parsing — connection opens, stream terminates cleanly
php tests/Step3SseParsingTest.php

# CP4: Token extraction + accumulation — delta content extracted, full response assembled
php tests/Step4AccumulationTest.php

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
php tests/Step5RendererTest.php

# CP6: Proxy server — starts php -S in subprocess, relays SSE, CORS headers present
php tests/Step6ProxyTest.php
```

CP6 spawns `php -S` automatically as a subprocess — you do not need to start
the proxy manually before running it.

## Structure

```
php/
├── src/
│   ├── index.php                 # Entry point
│   ├── Auth/TokenManager.php     # OAuth2 token management
│   ├── Streaming/StreamClient.php  # SSE parsing + accumulation
│   ├── Browser/Renderer.php      # Typing-effect CLI demo
│   └── Proxy/Server.php          # ob_flush SSE proxy
└── composer.json
```
