#!/usr/bin/env python3
"""
Streaming AI Responses in Real Time - Python Implementation

Demonstrates SSE-based streaming from the Gloo AI completions API.
Shows token accumulation, typing-effect rendering, and error handling.
"""

import os
from dotenv import load_dotenv
from streaming.stream_client import stream_completion
from browser.renderer import render_stream_to_terminal

load_dotenv()


def main():
    print("Streaming AI Responses in Real Time\n")

    api_key = os.getenv("GLOO_API_KEY")

    if not api_key:
        print("Missing credentials. Set GLOO_API_KEY")
        return

    print("✓ API key loaded\n")

    # --- Example 1: Accumulate full response ---
    print("Example: Streaming a completion (accumulate full text)...")
    token = os.getenv("GLOO_API_KEY")
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
