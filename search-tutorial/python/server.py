#!/usr/bin/env python3
"""
Gloo AI Search API - Proxy Server (Python/Flask)

A lightweight Flask server that proxies search requests to the Gloo AI API.
The frontend calls this server instead of the Gloo API directly,
keeping credentials secure on the server side.

Endpoints:
  GET  /api/search?q=<query>&limit=<limit>  - Basic search
  POST /api/search/rag                       - Search + RAG with Completions V2
"""

import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from auth import TokenManager, validate_credentials
from search_basic import SearchClient
from search_advanced import AdvancedSearchClient, RAGHelper
import os
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_URL,
    PORT,
    RAG_CONTEXT_MAX_SNIPPETS,
    RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
)
from utils import normalize_limit

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend-example", "simple-html")

# Validate credentials on startup
validate_credentials(CLIENT_ID, CLIENT_SECRET)

# Shared instances
token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
search_client = SearchClient(token_manager)
advanced_search_client = AdvancedSearchClient(token_manager)
rag_helper = RAGHelper(token_manager)

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)


@app.route("/")
def index():
    """Serve the frontend."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    """Serve static frontend files."""
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/api/search")
def api_search():
    """Basic search endpoint."""
    query = request.args.get("q")
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    limit = normalize_limit(request.args.get("limit", "10"), 10)

    try:
        results = search_client.search(query, limit)
        return jsonify(results)
    except Exception as e:
        print(f"Search error: {e}", file=sys.stderr)
        return jsonify({"error": "Search request failed"}), 500


@app.route("/api/search/rag", methods=["POST"])
def api_rag():
    """RAG search endpoint."""
    body = request.get_json()
    if not body or not body.get("query"):
        return jsonify({"error": "Field 'query' is required"}), 400

    query = body["query"]
    limit = normalize_limit(body.get("limit", 5), 5)
    system_prompt = body.get("systemPrompt")

    try:
        # Step 1: Search
        results = advanced_search_client.search(query, limit)

        if not results.get("data"):
            return jsonify({"response": "No relevant content found.", "sources": []})

        # Step 2: Extract snippets and format context
        snippet_limit = min(limit, RAG_CONTEXT_MAX_SNIPPETS)
        snippets = rag_helper.extract_snippets(
            results,
            max_snippets=snippet_limit,
            max_chars_per_snippet=RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
        )
        context = rag_helper.format_context_for_llm(snippets)

        # Step 3: Generate response
        generated_response = rag_helper.generate_with_context(query, context, system_prompt)

        return jsonify({
            "response": generated_response,
            "sources": [{"title": s["title"], "type": s["type"]} for s in snippets],
        })
    except Exception as e:
        print(f"RAG error: {e}", file=sys.stderr)
        return jsonify({"error": "RAG request failed"}), 500


if __name__ == "__main__":
    print(f"Search API proxy server running at http://localhost:{PORT}")
    print(f"Frontend available at http://localhost:{PORT}")
    print(f"\nAPI endpoints:")
    print(f"  GET  http://localhost:{PORT}/api/search?q=your+query&limit=10")
    print(f"  POST http://localhost:{PORT}/api/search/rag")
    app.run(host="0.0.0.0", port=PORT, debug=False)
