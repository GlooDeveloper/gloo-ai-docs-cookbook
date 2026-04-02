"""
Flask SSE proxy server for streaming completions.

Relays streaming requests from the browser to the Gloo AI API,
forwarding the SSE stream back to the client. This avoids exposing
API credentials in the browser.
"""

import os
import requests
from flask import Flask, Response, request
from dotenv import load_dotenv

# Import auth from parent package context (run from project root)
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.token_manager import ensure_valid_token

load_dotenv()

API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

app = Flask(__name__)

CORS_ORIGIN = os.getenv("PROXY_CORS_ORIGIN", "http://localhost:3000")


@app.after_request
def add_cors_headers(response):
    """Add CORS headers to all responses."""
    response.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route("/api/stream", methods=["POST", "OPTIONS"])
def stream_proxy():
    # TODO: Implement the Flask SSE proxy handler (Step 8):
    # 1. Handle OPTIONS preflight requests and capture the incoming JSON body
    # 2. Define a generate() inner function that retrieves the server-side auth token
    # 3. Inside generate(), send the upstream POST request with stream enabled and handle non-200 responses
    # 4. Yield each SSE line from the upstream response as it arrives, wrapping in try/except for errors
    # 5. Return a Flask Response with the generator and the required SSE headers
    raise NotImplementedError("Not implemented - see TODO comments")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "completions-streaming-proxy"}


if __name__ == "__main__":
    port = int(os.getenv("PROXY_PORT", 3001))
    print(f"Starting proxy server on http://localhost:{port}")
    print(f"CORS allowed origin: {CORS_ORIGIN}")
    app.run(host="0.0.0.0", port=port, debug=False)
