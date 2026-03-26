# Streaming AI Responses in Real Time — Python

Python implementation of real-time SSE streaming with the Gloo AI completions API.

## Prerequisites

- Python 3.9+
- Gloo AI credentials (get them at https://platform.ai.gloo.com/studio/manage-api-credentials)

## Setup

```bash
cd final/python

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# Edit .env and fill in GLOO_CLIENT_ID and GLOO_CLIENT_SECRET
```

## Run the Demo

```bash
python main.py
```

## Proxy Server

Start the proxy manually (listens on `PROXY_PORT`, default 3001):

```bash
python proxy/server.py
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

**Important:** All commands must be run from `final/python/` with the virtual
environment activated.

```bash
# CP1: Auth & environment — credentials load, token obtained, endpoint returns 200
python tests/step1_auth_test.py

# CP2: Streaming request + SSE parsing — connection opens, stream terminates cleanly
python tests/step2_sse_parsing_test.py

# CP3: Token extraction + accumulation — delta content extracted, full response assembled
python tests/step3_accumulation_test.py

# CP4: Error handling — 401/403/429 raise correct errors, bad credentials caught
python tests/step4_error_handling_test.py

# CP5: CLI typing-effect renderer — tokens stream to terminal with summary line
python tests/step5_renderer_test.py

# CP6: Proxy server — starts in background thread, relays SSE, CORS headers present
python tests/step6_proxy_test.py
```

CP6 starts the Flask proxy automatically in a background thread — you do not
need to start the proxy manually before running it.

## Project Structure

```
python/
├── main.py                      # Entry point
├── auth/
│   └── token_manager.py         # OAuth2 token management (pre-built)
├── streaming/
│   └── stream_client.py         # SSE parsing + accumulation (teaching layer)
├── browser/
│   └── renderer.py              # Typing-effect CLI renderer
├── proxy/
│   └── server.py                # Flask SSE proxy (Track B)
├── tests/                       # Checkpoint validation scripts
├── requirements.txt
├── .env.example
└── README.md
```

## Compare with Starter

The `starter/python/` directory contains the same structure with the teaching
functions stubbed out for you to implement. See the tutorial for step-by-step guidance.

- [Final implementation](../final/python/) — this directory
- [Starter project](../../starter/python/) — stubbed for you to complete
