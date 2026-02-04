# Gloo AI Completions V2 Tutorial - TypeScript

This example demonstrates how to use the Gloo AI Completions V2 API with its three routing strategies: auto-routing, model family selection, and direct model selection.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env` file in this directory:
   ```bash
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

3. **Get your credentials:**

   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
npm start
```

## Key Features

- **Type Safety**: Full TypeScript type definitions for API requests and responses
- **Auto-Routing**: Let Gloo AI automatically select the optimal model based on query complexity
- **Model Family Selection**: Choose a provider family (anthropic, openai, google, open source)
- **Direct Model Selection**: Specify an exact model for full control
- **Token Management**: Automatic token refresh when expired

## V2 Routing Strategies

| Mode | Use Case | Parameter |
|------|----------|-----------|
| **AI Core** (Recommended) | Let Gloo AI automatically select the best model | `auto_routing: true` |
| **AI Core Select** | Choose a provider family, let Gloo pick the model | `model_family: "anthropic"` |
| **AI Select** | Specify an exact model | `model: "gloo-anthropic-claude-sonnet-4.5"` |

## Learn More

- [Completions V2 Tutorial](https://docs.gloo.com/tutorials/completions-v2)
- [Completions V2 API Guide](https://docs.gloo.com/api-guides/completions-v2)
- [Supported Models](https://docs.gloo.com/api-guides/supported-models)
