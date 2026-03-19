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

## Proxy Server (Track B — Steps 8–9)

```bash
python proxy/server.py
```

## Checkpoint Validation

Run individual checkpoint tests to validate each step:

```bash
# CP1: Auth & environment
python tests/step1_auth_test.py

# CP2: Streaming request + SSE parsing
python tests/step2_sse_parsing_test.py

# CP3: Token extraction + accumulation
python tests/step3_accumulation_test.py

# CP4: Error handling
python tests/step4_error_handling_test.py

# CP5: CLI typing-effect renderer
python tests/step5_renderer_test.py
```

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
