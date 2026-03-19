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
