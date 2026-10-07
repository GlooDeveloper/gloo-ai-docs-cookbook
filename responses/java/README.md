# Gloo AI Guarded Responses API Recipe - Java

This example demonstrates four features of the Gloo AI Responses API (POST `/ai/v2/guarded/responses`): basic guarded responses with tradition, instructions + multi-turn input, streaming (SSE), and vision (image input).

## Setup

1. **Install dependencies:**
   ```bash
   mvn compile
   ```

2. **Set up environment variables:**

   Copy `.env.example` to `.env` and fill in your API key (or run the recipe setup script, which generates `.env` from the master env file):
   ```bash
   GLOO_API_KEY=your_api_key_here
   ```

3. **Get your API key:**

   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Running the Example

```bash
mvn exec:java
```

## Requirements

- Java 17+
- Maven
- Dependencies: `com.google.code.gson:gson`, `io.github.cdimascio:java-dotenv`

## Key Features

- **Basic Guarded Response**: Simple string input with a `tradition` parameter (e.g., `evangelical`)
- **Instructions + Multi-turn Input**: System-style instructions plus an input array alternating `user` → `assistant` → `user` roles
- **Streaming (SSE)**: `stream: true` with `HttpClient` + `BodyHandlers.ofInputStream()` and a `BufferedReader` parsing `event:` / `data:` lines — prints `response.output_text.delta` tokens as they arrive and collects usage from `response.completed`
- **Vision**: Image input via typed content parts (`input_text` + `input_image`)

## Configuration

Environment variables (all optional except `GLOO_API_KEY`):

| Variable | Default |
|----------|---------|
| `GLOO_API_KEY` | — (required) |
| `GLOO_MODEL` | `gloo-anthropic-claude-sonnet-4.6` |
| `GLOO_VISION_MODEL` | `gloo-google-gemini-3.1-pro` |
| `VISION_IMAGE_URL` | `https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg` |

## Learn More

- [Responses API Guide](https://docs.gloo.com/api-guides/responses)
- [Supported Models](https://docs.gloo.com/api-guides/supported-models)
