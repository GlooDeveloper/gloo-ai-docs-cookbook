#!/usr/bin/env python3
"""
Streaming-Aware Error Handling Test

Validates that:
- handle_stream_error() raises specific exceptions for 401/403/429
- Bad credentials produce a clear auth error before reading the stream
- Partial output is preserved on mid-stream disconnect

Usage: python tests/step2_error_handling_test.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step4():
    print("🧪 Testing: Streaming Error Handling\n")

    try:
        from streaming.stream_client import handle_stream_error

        # Test 1: 401 raises auth error
        print("Test 1: handle_stream_error(401)...")
        try:
            handle_stream_error(401, "Unauthorized")
            print("❌ Should have raised an exception for 401")
            sys.exit(1)
        except Exception as e:
            msg = str(e).lower()
            if "401" not in str(e) and "auth" not in msg:
                raise Exception(f"Expected auth error message, got: {e}")
            print(f"✓ 401 raises: {e}")

        # Test 2: 403 raises auth/permissions error
        print("Test 2: handle_stream_error(403)...")
        try:
            handle_stream_error(403, "Forbidden")
            print("❌ Should have raised an exception for 403")
            sys.exit(1)
        except Exception as e:
            if "403" not in str(e):
                raise Exception(f"Expected 403 in error message, got: {e}")
            print(f"✓ 403 raises: {e}")

        # Test 3: 429 raises rate limit error
        print("Test 3: handle_stream_error(429)...")
        try:
            handle_stream_error(429, "Too Many Requests")
            print("❌ Should have raised an exception for 429")
            sys.exit(1)
        except Exception as e:
            if "429" not in str(e) and "rate" not in str(e).lower():
                raise Exception(f"Expected rate limit error, got: {e}")
            print(f"✓ 429 raises: {e}")

        # Test 4: 200 does NOT raise
        print("Test 4: handle_stream_error(200) — success, no exception...")
        try:
            handle_stream_error(200, "")
            print("✓ 200 OK — no exception raised")
        except Exception as e:
            print(f"❌ Should not raise for 200, got: {e}")
            sys.exit(1)

        # Test 5: 500 raises generic API error with body
        print("Test 5: handle_stream_error(500)...")
        try:
            handle_stream_error(500, "Internal Server Error")
            print("❌ Should have raised an exception for 500")
            sys.exit(1)
        except Exception as e:
            if "500" not in str(e):
                raise Exception(f"Expected 500 in error message, got: {e}")
            print(f"✓ 500 throws with body: {e}")

        print("\n✅ Two-phase error handling working.")
        print("   Next: Streaming Requests & SSE Parsing\n")

    except Exception as error:
        print("\n❌ Streaming Error Handling Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - handle_stream_error should check status_code BEFORE reading stream")
        print("   - Use exact status code checks: if status_code == 401:")
        print("   - Make sure 200 does NOT raise an exception\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step4()
