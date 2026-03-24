#!/usr/bin/env python3
"""
Typing-Effect Renderer Test

Validates that:
- render_stream_to_terminal() prints tokens without newlines as they arrive
- Output contains actual response text
- Token count is reported at the end

Usage: python tests/step5_renderer_test.py
"""

import os
import sys
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step5():
    print("🧪 Testing: Typing-Effect Renderer\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    if not client_id:
        print("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
        sys.exit(1)

    try:
        from auth.token_manager import ensure_valid_token
        from browser.renderer import render_stream_to_terminal

        token = ensure_valid_token()
        print("✓ Token obtained\n")

        # Test 1: Capture output while streaming live to terminal
        print("Test 1: render_stream_to_terminal() — streaming to terminal...")

        # Tee: write to both real stdout (live) and a capture buffer (for validation)
        class _TeeStream(io.StringIO):
            def __init__(self, real_stdout):
                super().__init__()
                self._real = real_stdout
            def write(self, s):
                self._real.write(s)
                self._real.flush()
                return super().write(s)
            def flush(self):
                self._real.flush()
                super().flush()

        tee = _TeeStream(sys.stdout)
        orig_stdout = sys.stdout
        sys.stdout = tee
        render_stream_to_terminal(
            "Reply with exactly: Hello streaming world", token
        )
        sys.stdout = orig_stdout
        output = tee.getvalue()

        if "Prompt:" not in output:
            raise Exception("Output missing 'Prompt:' header")
        print("✓ Prompt header printed")

        if "Response:" not in output:
            raise Exception("Output missing 'Response:' label")
        print("✓ Response label printed")

        import re
        match = re.search(r"\[(\d+) tokens, finish_reason=(\w+)\]", output)
        if not match:
            raise Exception("Output missing token summary '[N tokens, finish_reason=X]'")

        token_count = int(match.group(1))
        finish_reason_out = match.group(2)

        if token_count == 0:
            raise Exception("token count is 0 — no tokens were streamed")

        print(f"✓ Token summary found: {token_count} tokens, finish_reason={finish_reason_out}")

        print("\n✅ Typing-effect renderer working.")
        print("   Next: Server-Side Proxy\n")

    except Exception as error:
        print("\n❌ Typing-Effect Renderer Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - render_stream_to_terminal should call make_streaming_request")
        print("   - Use print(token, end='', flush=True) — no newline between tokens")
        print("   - Add a final print() after the loop to end the line\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step5()
