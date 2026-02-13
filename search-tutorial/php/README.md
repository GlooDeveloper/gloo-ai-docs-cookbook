# Search API - PHP Example

This example demonstrates how to use the Gloo AI Search API with PHP to perform semantic search on your ingested content.

## Features

- **Basic Search**: Simple semantic search with authentication
- **Advanced Filtering**: Filter results by content type
- **RAG Support**: Extract and format search results for Retrieval Augmented Generation
- **Completions Integration**: Use search results with Completions V2 API
- **Token Management**: Automatic token refresh when expired
- **Proxy Server**: Built-in PHP server with frontend UI for browser-based search
- **Error Handling**: Comprehensive error handling for network and API issues

## Prerequisites

- PHP 8.1+ installed with cURL extension
- Composer installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)
- Content already uploaded to Gloo AI (see [Upload Files Tutorial](https://docs.ai.gloo.com/tutorials/upload-files))

## Installation

1. Install dependencies:
```bash
composer install
```

2. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
GLOO_TENANT=your_tenant_name_here
```

## Usage

### Basic Search

Perform a simple semantic search:
```bash
php search_basic.php "How can I know my purpose?"
```

With custom result limit:
```bash
php search_basic.php "purpose" 5
```

### Advanced Search - Filtering

Search with content type filtering:
```bash
php search_advanced.php filter "purpose" "Article,Video" 10
```

### Advanced Search - RAG (Retrieval Augmented Generation)

Search and generate a response using the Completions V2 API:
```bash
php search_advanced.php rag "How can I know my purpose?" 5
```

## Frontend / Proxy Server

A proxy server is included that serves a browser-based search UI while keeping your API credentials secure on the server side.

### Start the Server

```bash
php -S localhost:3000 server.php
```

The server starts at [http://localhost:3000](http://localhost:3000) and provides:

- **Search UI** at [http://localhost:3000](http://localhost:3000) - A web interface with search and "Ask AI" (RAG) buttons
- `GET /api/search?q=<query>&limit=<limit>` - Basic search API
- `POST /api/search/rag` - RAG search API (accepts JSON body with `query`, `limit`, `systemPrompt`)

The frontend is served from `../frontend-example/simple-html/` and works with any language's proxy server.

## Configuration

### Environment Variables
- `GLOO_CLIENT_ID`: Your Gloo AI Client ID (required)
- `GLOO_CLIENT_SECRET`: Your Gloo AI Client Secret (required)
- `GLOO_TENANT`: Your tenant (publisher) name (required)
- `RAG_MAX_TOKENS`: Max completion tokens for RAG generation (optional, default: `3000`)
- `RAG_CONTEXT_MAX_SNIPPETS`: Max snippets included in RAG context (optional, default: `5`)
- `RAG_CONTEXT_MAX_CHARS_PER_SNIPPET`: Max chars per snippet in RAG context (optional, default: `350`)

### Search Parameters
- `query`: The search query string
- `limit`: Number of results to return (10-100 recommended, default: 10)
- `collection`: Always set to "GlooProd" (handled automatically)
- `certainty`: Relevance threshold (default: 0.5, matches Playground)

## Error Handling

The scripts handle various error conditions:
- Invalid credentials
- Network timeouts
- No results found
- API errors (403 Forbidden, 401 Unauthorized, etc.)
- Token expiration

## Learn More

- [Grounded Completions](https://docs.ai.gloo.com/tutorials/completions-grounded) - Simpler RAG approach
- [Completions V2 API](https://docs.ai.gloo.com/api-guides/completions-v2) - Full control over LLM interactions
- [API Reference](https://docs.ai.gloo.com/api-reference/data/search-publisher-data) - Full endpoint documentation
