# Gloo AI Guarded Responses API Recipe - Python

This recipe demonstrates four features of the Gloo AI **Responses API**
(`POST https://platform.ai.gloo.com/ai/v2/guarded/responses`):

1. **Basic guarded response** — a simple prompt with a values-aligned
   `tradition` (`evangelical` / `catholic` / `mainline`).
2. **Instructions + multi-turn input** — top-level `instructions` plus an
   `input` array of `{role, content}` items.
3. **Streaming** — `stream: true` with Server-Sent Events
   (`response.output_text.delta`, `response.completed`, ...).
4. **Vision** — image input via typed content parts
   (`input_text` + `input_image`).

## Prerequisites

- Python 3.8+
- A Gloo AI API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Setup

```bash
cd gloo-ai-docs-cookbook/responses/python

# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt
```

## Environment

Copy `.env.example` to `.env` and fill in your API key (or run the recipe
setup script, which generates `.env` from the master env file):

```bash
GLOO_API_KEY=your_api_key
GLOO_MODEL=gloo-anthropic-claude-sonnet-4.6
GLOO_VISION_MODEL=gloo-google-gemini-3.1-pro
VISION_IMAGE_URL=https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg
```

Only `GLOO_API_KEY` is required. The model and image variables are optional —
if unset, the script falls back to the defaults shown above.

## Run

```bash
python main.py
```

Expected output: a `=== Gloo AI Guarded Responses API Test ===` banner, four
`Example N:` sections each printing the model used, a ~100-char preview of the
assistant text, token usage, and a `✓ Example N passed` line, ending with
`=== All Responses API tests passed! ===`.

## Notes

- Guardrails are always on. Blocked prompts come back either as a normal
  response containing a curated static answer, or as an HTTP `403` hard block
  (the script prints a clear error including the response body).
- Streaming events other than the known `response.*` events (including
  `error.*`) are treated as terminal and abort the stream.
- `usage` is always present on streamed responses' `response.completed` event.
