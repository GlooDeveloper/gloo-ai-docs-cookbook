#!/usr/bin/env python3

"""
Gloo AI Guarded Responses API Recipe - Python

This example demonstrates four features of the Gloo AI Responses API
(POST /ai/v2/guarded/responses): basic guarded responses with tradition,
instructions + multi-turn input, streaming (SSE), and vision (image input).
"""

import json
import os

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv("GLOO_API_KEY", "YOUR_API_KEY")
API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/responses"


def _env_is_placeholder(value):
    """True when a .env value is an unset placeholder (empty or a TODO comment)."""
    stripped = value.strip()
    return not stripped or stripped.startswith("#")


def _env(name, default):
    """Env value or default, ignoring unset placeholders (empty / TODO comments)."""
    value = os.getenv(name, "")
    return default if _env_is_placeholder(value) else value


MODEL = _env("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6")
VISION_MODEL = _env("GLOO_VISION_MODEL", "gloo-google-gemini-3.1-pro")
VISION_IMAGE_URL = _env(
    "VISION_IMAGE_URL",
    "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg",
)


def _headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }


def _post(payload):
    """POST a request, raising a clear error (including the response body) on failure."""
    response = requests.post(API_URL, headers=_headers(), json=payload)
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        status = response.status_code
        hint = " (guardrails hard-blocked this request)" if status == 403 else ""
        raise RuntimeError(
            f"API request failed with status {status}{hint}: {response.text}"
        ) from e
    return response.json()


def extract_text(result):
    """Extract assistant text from a Responses API payload's output[] array."""
    parts = []
    for item in result.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                parts.append(content.get("text", ""))
    return "\n".join(parts)


def make_basic_response(message, tradition="evangelical"):
    """Example 1: Basic guarded response with a theological tradition."""
    payload = {
        "model": MODEL,
        "input": message,
        "tradition": tradition,
        "max_output_tokens": 256,
    }
    return _post(payload)


def make_instructions_response(instructions, input_items):
    """Example 2: Instructions plus multi-turn input array (alternating user/assistant roles)."""
    payload = {
        "model": MODEL,
        "instructions": instructions,
        "input": input_items,
        "max_output_tokens": 256,
    }
    return _post(payload)


def stream_response(message):
    """Example 3: Streaming via SSE; returns (accumulated_text, usage)."""
    payload = {
        "model": MODEL,
        "input": message,
        "stream": True,
        "max_output_tokens": 256,
    }

    response = requests.post(API_URL, headers=_headers(), json=payload, stream=True)
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        status = response.status_code
        hint = " (guardrails hard-blocked this request)" if status == 403 else ""
        raise RuntimeError(
            f"API request failed with status {status}{hint}: {response.text}"
        ) from e

    text_parts = []
    done_parts = []
    usage = None
    event = None

    # Note: each data: payload is the flattened event object itself (its "type"
    # matches the event: line); there is no nested "response" key, and the
    # response.completed payload carries usage but not the output[] array.
    for line in response.iter_lines(decode_unicode=True):
        if line is None:
            continue
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
            continue
        if not line.startswith("data:"):
            continue

        raw = line[len("data:"):].strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            # Malformed SSE data is a terminal error, not something to skip.
            raise RuntimeError(f"Stream terminated by malformed SSE data: {line!r}") from e

        if event == "response.output_text.delta":
            delta = data.get("delta", "")
            print(delta, end="", flush=True)
            text_parts.append(delta)
        elif event == "response.output_text.done":
            done_parts.append(data.get("text", ""))
        elif event == "response.completed":
            # Docs nest the final response under "response"; the live API
            # flattens it into the payload itself. Accept both shapes.
            final = data.get("response") or data
            usage = final.get("usage")
            if not text_parts and not done_parts:
                done_parts.append(extract_text(final))
        elif event is not None and event.startswith("response."):
            # Other lifecycle events (response.created, response.in_progress,
            # response.output_item.*, response.content_part.*, ...).
            pass
        elif event is not None and event.startswith("error"):
            # Error events are terminal.
            raise RuntimeError(f"Stream error event '{event}': {data}")
        else:
            # Unknown event: treat as terminal and close the stream.
            raise RuntimeError(f"Stream terminated by unknown event '{event}': {data}")

        event = None

    print()
    text = "".join(text_parts) or "".join(done_parts)
    return text, usage


def make_vision_response(image_url, question):
    """Example 4: Vision — image input via typed content parts."""
    payload = {
        "model": VISION_MODEL,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": question},
                    {"type": "input_image", "image_url": image_url},
                ],
            }
        ],
        "max_output_tokens": 256,
    }
    return _post(payload)


def test_responses_api():
    """Run all four examples against the live API."""
    print("=== Gloo AI Guarded Responses API Test ===\n")

    try:
        # Example 1: Basic guarded response with tradition
        print("Example 1: Basic Guarded Response (tradition=evangelical)")
        print("Testing: How can our small group support a grieving member?")
        result1 = make_basic_response("How can our small group support a grieving member?")
        print(f"   Model used: {result1.get('model', 'N/A')}")
        text1 = extract_text(result1)
        print(f"   Response: {text1[:100]}...")
        print(f"   Usage: {result1.get('usage', 'N/A')}")
        print("   ✓ Example 1 passed\n")

        # Example 2: Instructions + multi-turn input
        print("Example 2: Instructions + Multi-turn Input")
        print("Testing: three-turn conversation (user → assistant → user) with pastoral-care instructions")
        result2 = make_instructions_response(
            "You are a compassionate pastoral assistant. Keep answers brief and warm.",
            [
                {
                    "role": "user",
                    "content": "I've been asked to lead a grief support group at church. Where do I start?",
                },
                {
                    "role": "assistant",
                    "content": "That's a meaningful calling. Start with prayerful preparation — ask God to prepare your own heart before you prepare the room.",
                },
                {
                    "role": "user",
                    "content": "What should I do in the very first meeting?",
                },
            ],
        )
        print(f"   Model used: {result2.get('model', 'N/A')}")
        text2 = extract_text(result2)
        print(f"   Response: {text2[:100]}...")
        print(f"   Usage: {result2.get('usage', 'N/A')}")
        print("   ✓ Example 2 passed\n")

        # Example 3: Streaming
        print("Example 3: Streaming (SSE)")
        print("Testing: Write a one-paragraph prayer for a new season of ministry.")
        text3, usage3 = stream_response(
            "Write a one-paragraph prayer for a new season of ministry."
        )
        print(f"   Model used: {MODEL}")
        print(f"   Streamed text ({len(text3)} chars): {text3[:100]}...")
        print(f"   Usage: {usage3}")
        if not text3:
            raise RuntimeError("streaming produced no text")
        if usage3 is None:
            raise RuntimeError("streaming produced no usage")
        print("   ✓ Example 3 passed\n")

        # Example 4: Vision
        print("Example 4: Vision (Image Input)")
        print(f"Testing: {VISION_IMAGE_URL}")
        result4 = make_vision_response(VISION_IMAGE_URL, "What animal is in this image?")
        print(f"   Model used: {result4.get('model', 'N/A')}")
        text4 = extract_text(result4)
        print(f"   Response: {text4[:100]}...")
        print(f"   Usage: {result4.get('usage', 'N/A')}")
        print("   ✓ Example 4 passed\n")

        print("=== All Responses API tests passed! ===")
        return True

    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False


def main():
    """Main execution."""
    if not API_KEY.strip() or API_KEY == "YOUR_API_KEY":
        print("Please set your GLOO_API_KEY environment variable")
        print("You can create a .env file with:")
        print("GLOO_API_KEY=your_api_key")
        return

    if not test_responses_api():
        raise SystemExit(1)


if __name__ == "__main__":
    main()
