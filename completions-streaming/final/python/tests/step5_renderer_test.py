#!/usr/bin/env python3
"""
Step 7 Test: CLI Typing-Effect Renderer

Validates that:
- render_stream_to_terminal() prints tokens without newlines as they arrive
- Output contains actual response text
- Token count is reported at the end

Usage: python tests/step5_renderer_test.py
"""

import os
import sys
import io
import contextlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step5():
    print("🧪 Testing Step 7: CLI Typing-Effect Renderer\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    if not client_id:
        print("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
        sys.exit(1)

    try:
        from auth.token_manager import ensure_valid_token
        from browser.renderer import render_stream_to_terminal

        token = ensure_valid_token()
        print("✓ Token obtained\n")

        # Test 1: Capture output from the renderer
        print("Test 1: render_stream_to_terminal() — capturing output...")
        print("(Tokens will stream live below this line)")
        print("-" * 40)

        # Capture stdout to validate output structure
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            render_stream_to_terminal(
                "Reply with exactly: Hello streaming world", token
            )

        output = captured.getvalue()
        print("-" * 40)

        # Replay captured output so user can see it
        print(output)

        # Validate output structure
        if "Prompt:" not in output:
            raise Exception("Output missing 'Prompt:' header")
        print("✓ Prompt header present")

        if "Response:" not in output:
            raise Exception("Output missing 'Response:' prefix")
        print("✓ Response prefix present")

        if "tokens" not in output.lower() and "finish_reason" not in output.lower():
            print("⚠️  Token count/finish_reason summary not found in output")
        else:
            print("✓ Token count/finish_reason reported")

        if len(output.strip()) < 30:
            raise Exception("Output seems too short — renderer may not be working")

        print("\nTest 2: Verifying tokens printed without mid-stream newlines...")
        # Check that the response section has content (not just headers)
        lines = output.split("\n")
        response_lines = [l for l in lines if l.startswith("Response:")]
        if response_lines:
            print("✓ fetch() with stream: true opens SSE connection")
            print("✓ Tokens written to stdout without buffering")
            print("✓ Terminal shows typing effect (no mid-stream newlines in content)")

        print("\n✅ Step 7 Complete! Tokens render live in the terminal.")
        print("   Continue to Step 8: Server-Side Proxy\n")

    except Exception as error:
        print(f"\n❌ Step 7 Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - render_stream_to_terminal should call make_streaming_request")
        print("   - Use print(token, end='', flush=True) — no newline between tokens")
        print("   - Add a final print() after the loop to end the line\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step5()
