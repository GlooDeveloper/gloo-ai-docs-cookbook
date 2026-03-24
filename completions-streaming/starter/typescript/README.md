# Streaming AI Responses in Real Time — TypeScript

TypeScript implementation of real-time SSE streaming with the Gloo AI completions API.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
npm start
```

## Proxy server (Track B)

```bash
npm run proxy
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

**Important:** All commands must be run from `final/typescript/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
npm run test:step1

# CP2: Streaming request + SSE parsing — connection opens, stream terminates cleanly
npm run test:step2

# CP3: Token extraction + accumulation — delta content extracted, full response assembled
npm run test:step3

# CP4: Error handling — 401/403/429 raise correct errors, bad credentials caught
npm run test:step4

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
npm run test:step5

# CP6: Proxy server — starts in child process, relays SSE, CORS headers present
npm run test:step6
```

CP6 starts the Express proxy automatically as a child process — you do not
need to start the proxy manually before running it.

## Structure

```
typescript/
├── src/
│   ├── index.ts                  # Entry point
│   ├── types.ts                  # TokenInfo, StreamResult, SSEChunk interfaces
│   ├── auth/tokenManager.ts      # OAuth2 token management
│   ├── streaming/streamClient.ts # SSE parsing + accumulation
│   ├── browser/renderer.ts       # Typing-effect CLI demo
│   └── proxy/server.ts           # Express SSE proxy
├── tsconfig.json
└── package.json
```
