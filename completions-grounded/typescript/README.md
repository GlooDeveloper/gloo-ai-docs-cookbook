# Grounded Completions Recipe - TypeScript

This TypeScript implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- Node.js 14.0 or higher
- npm or yarn
- Gloo AI account with API credentials
- Publisher created in [Gloo Studio](https://studio.ai.gloo.com) with content uploaded

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** with your credentials:
   - `GLOO_CLIENT_ID`: Your Client ID from [Studio Settings](https://studio.ai.gloo.com/settings/api-keys)
   - `GLOO_CLIENT_SECRET`: Your Client Secret
   - `PUBLISHER_NAME`: Name of your Publisher (default: "Bezalel")

## Running the Demo

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

To build and run compiled JavaScript:
```bash
npm run build
node dist/index.js
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## Type Definitions

```typescript
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CompletionResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  sources_returned?: boolean;
  model?: string;
}
```

## How It Works

### Token Management
```typescript
async function getAccessToken(): Promise<TokenResponse> {
  // Retrieve OAuth2 access token from Gloo AI
}

async function ensureValidToken(): Promise<string> {
  // Ensure we have a valid token, refreshing if needed
}
```

### Non-Grounded Request
```typescript
async function makeNonGroundedRequest(query: string): Promise<CompletionResponse> {
  // Standard completion WITHOUT RAG
  const payload = {
    messages: [{ role: 'user', content: query }],
    auto_routing: true,
    max_tokens: 500
  };
  // POST to /ai/v2/chat/completions
}
```

### Grounded Request
```typescript
async function makeGroundedRequest(
  query: string,
  publisherName: string,
  sourcesLimit: number = 3
): Promise<CompletionResponse> {
  // Grounded completion WITH RAG
  const payload = {
    messages: [{ role: 'user', content: query }],
    auto_routing: true,
    rag_publisher: publisherName,
    sources_limit: sourcesLimit,
    max_tokens: 500
  };
  // POST to /ai/v2/chat/completions/grounded
}
```

### Side-by-Side Comparison
```typescript
async function compareResponses(query: string, publisherName: string): Promise<void> {
  // Compare both approaches for the same query
}
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```typescript
// Use more sources for complex queries
const grounded = await makeGroundedRequest(query, publisherName, 5);
```

### Add Custom Queries

```typescript
async function main(): Promise<void> {
  const queries: string[] = [
    "Your custom question here",
    "Another question about your content"
  ];
  for (const query of queries) {
    await compareResponses(query, PUBLISHER_NAME);
  }
}
```

### Use as a Module

```typescript
import { makeGroundedRequest, compareResponses } from './index';

// Use in your own code
const result = await makeGroundedRequest(
  "Your query",
  "YourPublisher",
  3
);
```

## Troubleshooting

### Module Not Found Errors
```bash
npm install
```

### TypeScript Compilation Errors
```bash
npm run build
```

### Authentication Errors
- Verify `GLOO_CLIENT_ID` and `GLOO_CLIENT_SECRET` are correct
- Check credentials at [Studio Settings](https://studio.ai.gloo.com/settings/api-keys)

### Publisher Not Found
- Confirm publisher name matches exactly (case-sensitive)
- Verify publisher exists in [Gloo Studio](https://studio.ai.gloo.com)
- Ensure content is uploaded and indexed

### No Sources Returned
- Check that content is uploaded to the publisher
- Try increasing `sourcesLimit` parameter
- Verify query is relevant to uploaded content

## Learn More

- [Grounded Completions Recipe](https://docs.ai.gloo.com/tutorials/grounded-completions-recipe) - Full tutorial
- [Completions V2 API Guide](https://docs.ai.gloo.com/api-guides/completions-v2) - API documentation
- [Upload Content Tutorial](https://docs.ai.gloo.com/tutorials/upload-content) - Setting up Publishers
