# Gloo AI Guarded Responses API Recipe - TypeScript

This example demonstrates four features of the Gloo AI Responses API
(POST /ai/v2/guarded/responses): basic guarded responses with a theological
`tradition`, instructions + multi-turn input, streaming (SSE), and vision
(image input).

## Prerequisites

- Node.js 18+ (uses the global `fetch` API)

## Environment setup

Copy `.env.example` to `.env` and fill in your API key (or run the recipe setup script, which generates `.env` from the master env file):

```bash
GLOO_API_KEY=your_api_key
```

Optional overrides (defaults shown):

```bash
GLOO_MODEL=gloo-anthropic-claude-sonnet-4.6
GLOO_VISION_MODEL=gloo-google-gemini-3.1-pro
VISION_IMAGE_URL=https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg
```

Get your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Install & run

```bash
npm install
npx tsx index.ts   # or: npm start
```

The script runs four examples against the live API and prints results for each:

1. **Basic guarded response** — `tradition=evangelical`
2. **Instructions + multi-turn input** — pastoral-care instructions with a three-turn conversation
3. **Streaming (SSE)** — deltas printed as they arrive, with usage from the final event
4. **Vision** — image input ("What animal is in this image?") against the vision model

You should see `=== All Responses API tests passed! ===` when all four succeed.
