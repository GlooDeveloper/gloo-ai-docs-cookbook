#!/usr/bin/env python3
"""
Environment Setup & Auth Verification Test

Validates that the API key loads correctly and the streaming endpoint
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

    # Test 1: Check API key is set
    print("Test 1: Loading API key...")
    api_key = os.getenv("GLOO_API_KEY")

    if not api_key:
        print("❌ Missing required environment variable")
        print("   Make sure .env file contains:")
        print("   - GLOO_API_KEY")
        sys.exit(1)

    print("✓ API key loaded\n")

    try:
        # Test 2: Verify streaming endpoint returns 200 + text/event-stream
        print("Test 2: Verifying streaming endpoint...")
        import requests

        headers = {
            "Authorization": f"Bearer {api_key}",
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
                raise Exception(
                    f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
                )

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
        print("   - Check that .env has a valid GLOO_API_KEY")
        print(
            "   - Verify your credentials at https://studio.ai.gloo.com/api-keys"
        )
        print("   - Ensure you have internet connectivity\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step1()
