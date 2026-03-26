#!/usr/bin/env python3
"""
Token Extraction & Full Response Assembly Test

Validates that:
- extract_token_content() safely navigates choices[0].delta.content
- stream_completion() assembles the full text and tracks timing/count

Usage: python tests/step4_accumulation_test.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step3():
    print("🧪 Testing: Token Extraction & Accumulation\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    if not client_id:
        print("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
        sys.exit(1)

    try:
        from auth.token_manager import ensure_valid_token
        from streaming.stream_client import extract_token_content, stream_completion

        # Test 1: extract_token_content unit tests
        print("Test 1: extract_token_content — normal chunk...")
        chunk = {"choices": [{"delta": {"content": "Hello"}, "finish_reason": None}]}
        result = extract_token_content(chunk)
        assert result == "Hello", f"Expected 'Hello', got {result!r}"
        print("✓ Normal chunk → 'Hello'")

        print("Test 2: extract_token_content — null content delta...")
        chunk = {"choices": [{"delta": {"content": None}, "finish_reason": None}]}
        result = extract_token_content(chunk)
        assert result == "", f"Expected '', got {result!r}"
        print("✓ Null content → ''")

        print("Test 3: extract_token_content — empty delta (role-only chunk)...")
        chunk = {"choices": [{"delta": {}, "finish_reason": None}]}
        result = extract_token_content(chunk)
        assert result == "", f"Expected '', got {result!r}"
        print("✓ Empty delta → ''")

        print("Test 4: extract_token_content — no choices...")
        chunk = {"choices": []}
        result = extract_token_content(chunk)
        assert result == "", f"Expected '', got {result!r}"
        print("✓ Empty choices → ''")

        print("Test 5: extract_token_content — finish_reason chunk...")
        chunk = {"choices": [{"delta": {}, "finish_reason": "stop"}]}
        result = extract_token_content(chunk)
        assert result == "", f"Expected '', got {result!r}"
        print("✓ finish_reason chunk → '' (no content tokens from finish chunk)\n")

        # Test 6: Full stream_completion integration test
        print("Test 6: stream_completion — full response assembly...")
        token = ensure_valid_token()
        result = stream_completion(
            "Count from 1 to 5, separated by spaces. Reply with only the numbers.",
            token,
        )

        # Validate StreamResult structure
        assert isinstance(result, dict), f"Expected dict, got {type(result)}"
        assert "text" in result, "Missing 'text' key in result"
        assert "token_count" in result, "Missing 'token_count' key in result"
        assert "duration_ms" in result, "Missing 'duration_ms' key in result"
        assert "finish_reason" in result, "Missing 'finish_reason' key in result"

        print("✓ Delta content extraction working")
        print("✓ Null delta handled gracefully")
        print(f"✓ finish_reason detected: {result['finish_reason']}")
        print(f"✓ Duration tracked: {result['duration_ms']}ms")
        print(f"✓ Token count: {result['token_count']} tokens")

        if result["text"]:
            print(f"  Response preview: {result['text'][:80].strip()!r}")
        else:
            print("⚠️  Empty response text — check accumulation loop")

        if result["token_count"] == 0:
            raise Exception(
                "token_count is 0 — extract_token_content may not be working"
            )

        if result["duration_ms"] <= 0:
            raise Exception("duration_ms is 0 — timing not tracked")

        print("\n✅ Full response assembled.")
        print("   Next: Typing-Effect Renderer\n")

    except AssertionError as e:
        print(f"\n❌ Assertion failed: {e}")
        sys.exit(1)
    except Exception as error:
        print("\n❌ Token Extraction & Accumulation Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - extract_token_content: use chunk.get('choices', [])[0] pattern")
        print("   - delta.get('content') returns None if key missing — use 'or \"\"'")
        print(
            "   - stream_completion: increment token_count only when content is non-empty"
        )
        print("   - Capture start_time = time.time() before the request\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step3()
