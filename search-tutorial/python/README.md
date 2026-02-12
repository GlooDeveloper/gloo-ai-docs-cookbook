# Search API - Python Example

This example demonstrates how to use the Gloo AI Search API with Python to perform semantic search on your ingested content.

## Features

- **Basic Search**: Simple semantic search with authentication
- **Advanced Filtering**: Filter results by content type
- **RAG Support**: Extract and format search results for Retrieval Augmented Generation
- **Completions Integration**: Use search results with Completions V2 API
- **Token Management**: Automatic token refresh when expired
- **Proxy Server**: Flask server with frontend UI for browser-based search
- **Error Handling**: Comprehensive error handling for network and API issues

## Prerequisites

- Python 3.9+ installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)
- Content already uploaded to Gloo AI (see [Upload Files Tutorial](https://docs.ai.gloo.com/tutorials/upload-files))

## Installation

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
GLOO_TENANT=your_tenant_name_here
```

## Usage

### Basic Search

Perform a simple semantic search:
```bash
python search_basic.py "How can I know my purpose?"
```

With custom result limit:
```bash
python search_basic.py "purpose" 5
```

### Advanced Search - Filtering

Search with content type filtering:
```bash
python search_advanced.py filter "purpose" "Article,Video" 10
```

### Advanced Search - RAG (Retrieval Augmented Generation)

Search and generate a response using the Completions V2 API:
```bash
python search_advanced.py rag "How can I know my purpose?" 5
```

This command will:
1. Search for relevant content
2. Extract and format snippets
3. Generate a response using the Completions V2 API with the search results as context
4. Display the generated response and sources used

## Frontend / Proxy Server

A proxy server is included that serves a browser-based search UI while keeping your API credentials secure on the server side.

### Start the Server

```bash
source venv/bin/activate
python server.py
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

### Search Parameters
- `query`: The search query string
- `limit`: Number of results to return (10-100 recommended, default: 10)
- `collection`: Always set to "GlooProd" (handled automatically)

## Example Output

### Basic Search
```
Searching for: 'How can I know my purpose?'
Limit: 10 results

Found 10 results:

--- Result 1 ---
Title: Discovering Your Purpose in Life
Type: Article
Author: Jane Smith
Relevance Score: 0.8523
Snippet: Finding purpose is a journey that begins with understanding your unique gifts and calling. The Bible teaches that God has a specific plan for each person's life...

--- Result 2 ---
...
```

### RAG Search
```
RAG Search for: 'How can I know my purpose?'

Step 1: Searching for relevant content...
Found 5 results

Step 2: Extracting snippets...
Extracted 5 snippets

Step 3: Generating response with context...

=== Generated Response ===
Based on the provided sources, discovering your purpose involves several key steps:
1. Understanding your unique gifts and talents
2. Seeking God's guidance through prayer and scripture
3. Serving others and finding fulfillment in that service
...

=== Sources Used ===
- Discovering Your Purpose in Life (Article)
- Finding Meaning and Direction (Video)
- God's Plan for Your Life (Article)
...
```

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
