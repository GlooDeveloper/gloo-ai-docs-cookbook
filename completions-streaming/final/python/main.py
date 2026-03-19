#!/usr/bin/env python3
"""
Streaming AI Responses in Real Time - Python Implementation

Demonstrates SSE-based streaming from the Gloo AI completions API.
Shows token accumulation, typing-effect rendering, and error handling.
"""

import os
from dotenv import load_dotenv
from auth.token_manager import ensure_valid_token
from streaming.stream_client import stream_completion
from browser.renderer import render_stream_to_terminal

load_dotenv()


def main():
    print("Streaming AI Responses in Real Time\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    client_secret = os.getenv("GLOO_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET")
        return

    print("Environment variables loaded\n")

    # --- Example 1: Accumulate full response ---
    print("Example: Streaming a completion (accumulate full text)...")
    token = ensure_valid_token()
    result = stream_completion(
        "What is the significance of the resurrection?", token
    )
    print(f"\nFull response:\n{result['text']}")
    print(f"\nReceived {result['token_count']} tokens in {result['duration_ms']}ms")
    print(f"  Finish reason: {result['finish_reason']}")

    # --- Example 2: Typing-effect rendering ---
    print("\nExample: Typing-effect rendering...")
    render_stream_to_terminal("Tell me about Christian discipleship.", token)


if __name__ == "__main__":
    main()
