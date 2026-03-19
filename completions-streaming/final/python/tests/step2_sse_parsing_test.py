#!/usr/bin/env python3
"""
Step 2–3 Test: Streaming Request & SSE Line Parsing

Validates that:
- make_streaming_request() opens a streaming connection
- parse_sse_line() correctly parses data lines, blank lines, and [DONE]

Usage: python tests/step2_sse_parsing_test.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step2():
    print("🧪 Testing Steps 2–3: Streaming Request & SSE Line Parsing\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    if not client_id:
        print("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
        sys.exit(1)

    try:
        from auth.token_manager import ensure_valid_token
        from streaming.stream_client import make_streaming_request, parse_sse_line

        token = ensure_valid_token()
        print("✓ Token obtained\n")

        # Test 1: parse_sse_line unit tests (no network needed)
        print("Test 1: parse_sse_line — blank line...")
        result = parse_sse_line("")
        assert result is None, f"Expected None for blank line, got {result!r}"
        print("✓ Blank line → None")

        print("Test 2: parse_sse_line — non-data line...")
        result = parse_sse_line("event: message")
        assert result is None, f"Expected None for non-data line, got {result!r}"
        print("✓ Non-data line → None")

        print("Test 3: parse_sse_line — [DONE] sentinel...")
        result = parse_sse_line("data: [DONE]")
        assert result == "[DONE]", f"Expected '[DONE]', got {result!r}"
        print("✓ data: [DONE] → '[DONE]'")

        print("Test 4: parse_sse_line — valid JSON data line...")
        sample = 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}'
        result = parse_sse_line(sample)
        assert isinstance(result, dict), f"Expected dict, got {type(result)}"
        assert result["choices"][0]["delta"]["content"] == "Hello"
        print("✓ data: {json} → parsed dict")

        print("Test 5: parse_sse_line — malformed JSON...")
        result = parse_sse_line("data: {broken json")
        assert result is None, f"Expected None for malformed JSON, got {result!r}"
        print("✓ Malformed JSON → None (gracefully handled)\n")

        # Test 6: Live streaming connection
        print("Test 6: make_streaming_request() — live connection...")
        response = make_streaming_request(
            "Say exactly: 'Stream test OK'", token
        )

        if response.status_code != 200:
            raise Exception(f"Expected 200, got {response.status_code}")

        print(f"✓ Streaming connection opened (status 200)")

        # Test 7: Iterate lines and detect [DONE]
        print("Test 7: Iterating SSE lines and detecting [DONE]...")
        lines_seen = 0
        data_lines = 0
        done_detected = False

        for raw_line in response.iter_lines(decode_unicode=True):
            lines_seen += 1
            chunk = parse_sse_line(raw_line)
            if chunk == "[DONE]":
                done_detected = True
                break
            if isinstance(chunk, dict):
                data_lines += 1

        print(f"✓ Processed {lines_seen} lines, {data_lines} data chunks")

        if not done_detected:
            print("⚠️  [DONE] not detected — stream may have ended without sentinel")
        else:
            print("✓ [DONE] sentinel detected — stream terminated cleanly")

        print("\n✅ Steps 2–3 Complete! Streaming request and SSE parsing working.")
        print("   Continue to Step 4: Extracting Token Content\n")

    except AssertionError as e:
        print(f"\n❌ Assertion failed: {e}")
        sys.exit(1)
    except Exception as error:
        print(f"\n❌ Steps 2–3 Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - Check make_streaming_request() sets stream=True in the payload")
        print("   - Check parse_sse_line() strips 'data: ' prefix (6 characters)")
        print("   - Verify [DONE] check is case-sensitive: '[DONE]' not '[done]'\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step2()
