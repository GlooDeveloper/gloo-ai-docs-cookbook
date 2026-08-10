# Grounded Completions Recipe - JavaScript

This JavaScript implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- Node.js 14.0 or higher
- npm or yarn
- Gloo AI account with API key
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
   - `GLOO_API_KEY`: Your API key from [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)
   - `PUBLISHER_NAME`: Name of your Publisher (default: "Bezalel")

## Running the Demo

```bash
npm start
# or
node index.js
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## How It Works

### Authentication
```javascript
// API key is read from environment and used directly as Bearer token
const GLOO_API_KEY = process.env.GLOO_API_KEY;
headers: { 'Authorization': `Bearer ${GLOO_API_KEY}` }
```

### Non-Grounded Request
```javascript
async function makeNonGroundedRequest(query) {
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
```javascript
async function makeGroundedRequest(query, publisherName, sourcesLimit = 3) {
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
```javascript
async function compareResponses(query, publisherName) {
  // Compare both approaches for the same query
  // Makes both requests and displays results side-by-side
}
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```javascript
// Use more sources for complex queries
const grounded = await makeGroundedRequest(query, publisherName, 5);
```

### Add Custom Queries

```javascript
async function main() {
  const queries = [
    "Your custom question here",
    "Another question about your content"
  ];
  for (const query of queries) {
    await compareResponses(query, PUBLISHER_NAME);
  }
}
```

### Use as a Module

```javascript
const { makeGroundedRequest, compareResponses } = require('./index');

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

### Authentication Errors
- Verify `GLOO_API_KEY` is correct
- Check your API key at [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)

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
