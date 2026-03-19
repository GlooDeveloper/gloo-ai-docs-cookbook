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

## Checkpoint Validation

All checkpoint scripts are standalone — no test framework needed. Each script
makes real API calls and prints `✓`/`✅` on success or `❌` with hints on failure.

**Important:** All commands must be run from `final/typescript/`.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
node --loader ts-node/esm --no-warnings tests/step1-auth.test.ts

# CP2: Streaming request + SSE parsing — connection opens, [DONE] detected
node --loader ts-node/esm --no-warnings tests/step2-sse-parsing.test.ts

# CP3: Token extraction + accumulation — delta content extracted, full response assembled
node --loader ts-node/esm --no-warnings tests/step3-accumulation.test.ts

# CP4: Error handling — 401/403/429 raise correct errors, bad credentials caught
node --loader ts-node/esm --no-warnings tests/step4-error-handling.test.ts

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
node --loader ts-node/esm --no-warnings tests/step5-renderer.test.ts

# CP6: Proxy server — starts in child process, relays SSE, CORS headers present
node --loader ts-node/esm --no-warnings tests/step6-proxy.test.ts
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
