#!/usr/bin/env python3
"""
Environment Setup & Auth Verification Test

Validates that credentials load correctly and the streaming endpoint
responds with 200 OK and Content-Type: text/event-stream.

Usage: python tests/step1_auth_test.py
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step1():
    print("🧪 Testing: Environment Setup & Auth Verification\n")

    # Check environment variables
    client_id = os.getenv("GLOO_CLIENT_ID")
    client_secret = os.getenv("GLOO_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("❌ Missing required environment variables")
        print("   Make sure .env file contains:")
        print("   - GLOO_CLIENT_ID")
        print("   - GLOO_CLIENT_SECRET")
        sys.exit(1)

    print("✓ GLOO_CLIENT_ID loaded")
    print("✓ GLOO_CLIENT_SECRET loaded\n")

    try:
        from auth.token_manager import get_access_token, ensure_valid_token

        # Test 1: Get access token
        print("Test 1: Obtaining access token...")
        token_data = get_access_token()

        if not token_data.get("access_token"):
            raise Exception("Token response missing access_token field")

        print(f"✓ Access token obtained")
        print(f"  Expires in: {token_data.get('expires_in', 'N/A')} seconds")

        # Test 2: ensure_valid_token caches correctly
        print("\nTest 2: Token caching (ensure_valid_token)...")
        token1 = ensure_valid_token()
        token2 = ensure_valid_token()

        if token1 != token2:
            raise Exception("ensure_valid_token returned different tokens on consecutive calls")

        print("✓ Token cached correctly — same token returned on consecutive calls")

        # Test 3: Verify streaming endpoint returns 200 + text/event-stream
        print("\nTest 3: Verifying streaming endpoint...")
        import requests

        headers = {
            "Authorization": f"Bearer {token1}",
            "Content-Type": "application/json",
        }
        payload = {
            "messages": [{"role": "user", "content": "Hi"}],
            "auto_routing": True,
            "stream": True,
        }

        with requests.post(
            "https://platform.ai.gloo.com/ai/v2/chat/completions",
            headers=headers,
            json=payload,
            stream=True,
            timeout=15,
        ) as resp:
            if resp.status_code != 200:
                raise Exception(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")

            content_type = resp.headers.get("Content-Type", "")
            if "text/event-stream" not in content_type:
                raise Exception(
                    f"Expected Content-Type: text/event-stream, got: {content_type}"
                )

            print(f"✓ Status: 200 OK")
            print(f"✓ Content-Type: {content_type}")

        print("\n✅ Auth and streaming endpoint verified.")
        print("   Next: Making the Streaming Request\n")

    except Exception as error:
        print(f"\n❌ Auth Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - Check that .env has valid GLOO_CLIENT_ID and GLOO_CLIENT_SECRET")
        print("   - Verify your credentials at https://platform.ai.gloo.com/studio/manage-api-credentials")
        print("   - Ensure you have internet connectivity\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step1()
