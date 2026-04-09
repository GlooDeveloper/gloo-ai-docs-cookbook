#!/usr/bin/env python3
"""
Gloo AI Recommendations API - Proxy Server (Python/Flask)

A lightweight Flask server that proxies recommendation requests to the Gloo AI API.
The frontend calls this server instead of the Gloo API directly,
keeping credentials secure on the server side.

Endpoints:
  POST /api/recommendations/base       - Publisher-scoped recommendations (metadata only)
  POST /api/recommendations/verbose    - Publisher-scoped recommendations (with snippet text)
  POST /api/recommendations/affiliates - Cross-publisher affiliate network recommendations
"""

import sys
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from auth import TokenManager, validate_credentials
from recommend_base import RecommendationsClient
from recommend_verbose import VerboseRecommendationsClient
from recommend_affiliates import AffiliatesClient
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_URL,
    PORT,
    DEFAULT_ITEM_COUNT,
)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend-example", "simple-html")

# Validate credentials on startup
validate_credentials(CLIENT_ID, CLIENT_SECRET)

# Shared token manager and API clients
token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
base_client = RecommendationsClient(token_manager)
verbose_client = VerboseRecommendationsClient(token_manager)
affiliates_client = AffiliatesClient(token_manager)

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


@app.route("/api/recommendations/base", methods=["POST"])
def api_base():
    """Publisher-scoped recommendations without snippet text."""
    body = request.get_json()
    if not body or not body.get("query"):
        return jsonify({"error": "Field 'query' is required"}), 400

    query = body["query"]
    try:
        item_count = max(1, min(int(body.get("item_count", DEFAULT_ITEM_COUNT)), 50))
    except (TypeError, ValueError):
        item_count = DEFAULT_ITEM_COUNT

    try:
        items = base_client.get_base(query, item_count)
        return jsonify(items)
    except Exception as e:
        print(f"Base recommendations error: {e}", file=sys.stderr)
        return jsonify({"error": "Base recommendations request failed"}), 500


@app.route("/api/recommendations/verbose", methods=["POST"])
def api_verbose():
    """Publisher-scoped recommendations with full snippet text."""
    body = request.get_json()
    if not body or not body.get("query"):
        return jsonify({"error": "Field 'query' is required"}), 400

    query = body["query"]
    try:
        item_count = max(1, min(int(body.get("item_count", DEFAULT_ITEM_COUNT)), 50))
    except (TypeError, ValueError):
        item_count = DEFAULT_ITEM_COUNT

    try:
        items = verbose_client.get_verbose(query, item_count)
        return jsonify(items)
    except Exception as e:
        print(f"Verbose recommendations error: {e}", file=sys.stderr)
        return jsonify({"error": "Verbose recommendations request failed"}), 500


@app.route("/api/recommendations/affiliates", methods=["POST"])
def api_affiliates():
    """Cross-publisher affiliate network recommendations."""
    body = request.get_json()
    if not body or not body.get("query"):
        return jsonify({"error": "Field 'query' is required"}), 400

    query = body["query"]
    try:
        item_count = max(1, min(int(body.get("item_count", DEFAULT_ITEM_COUNT)), 50))
    except (TypeError, ValueError):
        item_count = DEFAULT_ITEM_COUNT

    try:
        items = affiliates_client.get_referenced_items(query, item_count)
        return jsonify(items)
    except Exception as e:
        print(f"Affiliates error: {e}", file=sys.stderr)
        return jsonify({"error": "Affiliates request failed"}), 500


if __name__ == "__main__":
    print(f"Recommendations API proxy server running at http://localhost:{PORT}")
    print(f"Frontend available at http://localhost:{PORT}")
    print(f"\nAPI endpoints:")
    print(f"  POST http://localhost:{PORT}/api/recommendations/base")
    print(f"  POST http://localhost:{PORT}/api/recommendations/verbose")
    print(f"  POST http://localhost:{PORT}/api/recommendations/affiliates")
    app.run(host="0.0.0.0", port=PORT, debug=False)
