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
