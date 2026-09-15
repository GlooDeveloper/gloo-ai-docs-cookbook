#!/usr/bin/env python3

"""
Gloo AI Authentication Tutorial - Python

This example demonstrates how to authenticate with the Gloo AI API
using API key authentication.
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv("GLOO_API_KEY", "")
API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"


def validate_credentials():
    """Validate that the required API key is configured."""
    if not API_KEY:
        print("Please set your GLOO_API_KEY environment variable")
        print("You can create a .env file with:")
        print("GLOO_API_KEY=your_api_key")
        return False
    return True


def make_authenticated_request(endpoint, payload=None):
    """Make an authenticated API request using the API key."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        if payload:
            response = requests.post(endpoint, headers=headers, json=payload)
        else:
            response = requests.get(endpoint, headers=headers)

        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making authenticated request: {e}")
        raise


def test_authentication():
    """Test the authentication implementation."""
    print("=== Gloo AI Authentication Test ===\n")

    try:
        # Test 1: Verify API key is configured
        print("1. Verifying API key is configured...")
        if not validate_credentials():
            return False
        print("   API key is set\n")

        # Test 2: API call with authentication
        print("2. Testing authenticated API call...")
        result = make_authenticated_request(API_URL, {
            "auto_routing": True,
            "messages": [{"role": "user", "content": "Hello! This is a test of the authentication system."}]
        })

        print("   API call successful")
        print(f"   Response: {result['choices'][0]['message']['content'][:100]}...\n")

        print("=== All tests passed! ===")
        return True

    except Exception as e:
        print(f"Authentication test failed: {e}")
        return False


def main():
    """Main execution."""
    if not validate_credentials():
        return

    test_authentication()


if __name__ == "__main__":
    main()
