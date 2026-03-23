"""
Streaming client for Gloo AI completions API.

Implements SSE parsing, token extraction, and accumulation loop for
real-time streaming responses.
"""

import json
import time
import requests

# API Endpoint
API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"


def handle_stream_error(status_code: int, response_body: str = "") -> None:
    """
    Check HTTP status before reading stream and raise specific errors.

    Called immediately after receiving the response status to fail fast
    with a clear error message before attempting to read the SSE stream.

    Args:
        status_code: HTTP status code from the response
        response_body: Response body text (used in generic error messages)

    Raises:
        Exception: With a descriptive message for 401, 403, 429, and other errors
    """
    if status_code == 401:
        raise Exception("Authentication failed (401): Invalid or expired token")
    elif status_code == 403:
        raise Exception("Authorization failed (403): Insufficient permissions")
    elif status_code == 429:
        raise Exception("Rate limit exceeded (429): Too many requests")
    elif status_code != 200:
        raise Exception(f"API error ({status_code}): {response_body[:200]}")


def make_streaming_request(message: str, token: str):
    """
    POST to the completions API with stream=True and return the raw response.

    The response is returned before the body is fully read, so the caller
    can iterate over the SSE lines as they arrive.

    Args:
        message: The user message to send
        token: Valid Bearer token for authorization

    Returns:
        requests.Response: Raw streaming response object

    Raises:
        Exception: If the server returns a non-200 status
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [{"role": "user", "content": message}],
        "auto_routing": True,
        "stream": True,
    }
    response = requests.post(API_URL, headers=headers, json=payload, stream=True)
    handle_stream_error(
        response.status_code,
        response.text if response.status_code != 200 else "",
    )
    return response


def parse_sse_line(line: str):
    """
    Parse one SSE text line from the stream.

    SSE lines follow the format: `data: <json-payload>`. The stream ends when
    a chunk arrives with a non-null `choices[0].finish_reason` (e.g. "stop").
    Blank lines and non-data lines are skipped. A `data: [DONE]` sentinel is
    handled for compatibility but is not sent by the Gloo AI API.

    Args:
        line: Raw text line from the SSE stream

    Returns:
        None: For blank lines or non-data lines
        '[DONE]': If a [DONE] sentinel is encountered (not sent by Gloo AI)
        dict: Parsed JSON payload for data lines
    """
    if not line or not line.strip():
        return None
    if not line.startswith("data: "):
        return None
    data = line[6:]  # strip 'data: ' prefix
    if data.strip() == "[DONE]":
        return "[DONE]"
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        return None


def extract_token_content(chunk: dict) -> str:
    """
    Safely extract the text content from a parsed SSE chunk.

    Navigates choices[0].delta.content with full null/missing-key safety.
    Returns empty string for any chunk that does not carry text content
    (e.g., role-only deltas or finish-reason-only chunks).

    Args:
        chunk: Parsed JSON dict from parse_sse_line

    Returns:
        str: The token text, or '' if none present
    """
    try:
        choices = chunk.get("choices", [])
        if not choices:
            return ""
        delta = choices[0].get("delta", {})
        return delta.get("content") or ""
    except (IndexError, AttributeError, KeyError):
        return ""


def stream_completion(message: str, token: str) -> dict:
    """
    Accumulation loop: stream a completion and collect the full result.

    Calls make_streaming_request, iterates SSE lines, parses each with
    parse_sse_line, extracts content with extract_token_content, and builds
    the full response text. Tracks elapsed time and token count.

    Args:
        message: The user message to send
        token: Valid Bearer token for authorization

    Returns:
        dict: StreamResult with keys:
            - text (str): Full accumulated response text
            - token_count (int): Number of content-bearing chunks received
            - duration_ms (int): Total request duration in milliseconds
            - finish_reason (str): Finish reason from the last chunk
    """
    start_time = time.time()
    response = make_streaming_request(message, token)

    full_text = ""
    token_count = 0
    finish_reason = "unknown"

    try:
        for raw_line in response.iter_lines(decode_unicode=True):
            chunk = parse_sse_line(raw_line)
            if chunk is None:
                continue
            if chunk == "[DONE]":
                break
            content = extract_token_content(chunk)
            if content:
                full_text += content
                token_count += 1
            choices = chunk.get("choices", [])
            if choices and choices[0].get("finish_reason"):
                finish_reason = choices[0]["finish_reason"]
    except Exception:
        if full_text:
            pass  # preserve partial output on error
        else:
            raise

    duration_ms = int((time.time() - start_time) * 1000)
    return {
        "text": full_text,
        "token_count": token_count,
        "duration_ms": duration_ms,
        "finish_reason": finish_reason,
    }
