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

## Proxy server (Track B)

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

## Checkpoint Validation

All checkpoint scripts are standalone — no test framework needed. Each script
makes real API calls and prints `✓`/`✅` on success or `❌` with hints on failure.

**Important:** All commands must be run from `final/php/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
php tests/Step1AuthTest.php

# CP2: Streaming request + SSE parsing — connection opens, [DONE] detected
php tests/Step2SseParsingTest.php

# CP3: Token extraction + accumulation — delta content extracted, full response assembled
php tests/Step3AccumulationTest.php

# CP4: Error handling — 401/403/429 raise correct errors, bad credentials caught
php tests/Step4ErrorHandlingTest.php

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
