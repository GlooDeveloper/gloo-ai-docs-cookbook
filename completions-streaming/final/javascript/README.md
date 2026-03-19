# Streaming AI Responses in Real Time — JavaScript

JavaScript (ESM) implementation of real-time SSE streaming with the Gloo AI completions API.

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

## Browser demo

Open `src/browser/index.html` after starting the proxy server.

## Checkpoint Validation

All checkpoint scripts are standalone — no test framework needed. Each script
makes real API calls and prints `✓`/`✅` on success or `❌` with hints on failure.

**Important:** All commands must be run from `final/javascript/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
node tests/step1-auth.test.js

# CP2: Streaming request + SSE parsing — connection opens, [DONE] detected
node tests/step2-sse-parsing.test.js

# CP3: Token extraction + accumulation — delta content extracted, full response assembled
node tests/step3-accumulation.test.js

# CP4: Error handling — 401/403/429 raise correct errors, bad credentials caught
node tests/step4-error-handling.test.js

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
node tests/step5-renderer.test.js

# CP6: Proxy server — starts in child process, relays SSE, CORS headers present
node tests/step6-proxy.test.js
```

CP6 starts the Express proxy automatically as a child process — you do not
need to start the proxy manually before running it.

## Structure

```
javascript/
├── src/
│   ├── index.js                 # Entry point
│   ├── auth/tokenManager.js     # OAuth2 token management
│   ├── streaming/streamClient.js  # SSE parsing + accumulation
│   ├── browser/
│   │   ├── renderer.js          # Typing-effect CLI demo
│   │   └── index.html           # Browser demo page
│   └── proxy/server.js          # Express SSE proxy
└── package.json
```
