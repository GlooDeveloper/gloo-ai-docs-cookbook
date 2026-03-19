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
    """
    Relay a streaming completion request to Gloo AI.

    Accepts a JSON body with at minimum a `messages` array. Injects
    `stream: true` and forwards the SSE response back to the caller
    with the correct event-stream headers.

    Returns:
        Response: SSE stream with Content-Type text/event-stream
    """
    if request.method == "OPTIONS":
        return Response(status=204)

    # Read request data before entering the generator so Flask's request
    # context is not needed after streaming begins.
    request_data = request.get_json() or {}

    def generate():
        try:
            auth_token = ensure_valid_token()
            data = request_data
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            }
            payload = {**data, "stream": True}

            with requests.post(
                API_URL, headers=headers, json=payload, stream=True
            ) as resp:
                if resp.status_code != 200:
                    error_msg = f"data: {{\"error\": \"API error {resp.status_code}\"}}\n\n"
                    yield error_msg
                    return

                for line in resp.iter_lines():
                    if line:
                        decoded = line.decode("utf-8")
                        yield f"{decoded}\n\n"

        except Exception as e:
            yield f'data: {{"error": "{str(e)}"}}\n\n'

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "completions-streaming-proxy"}


if __name__ == "__main__":
    port = int(os.getenv("PROXY_PORT", 3001))
    print(f"Starting proxy server on http://localhost:{port}")
    print(f"CORS allowed origin: {CORS_ORIGIN}")
    app.run(host="0.0.0.0", port=port, debug=False)
