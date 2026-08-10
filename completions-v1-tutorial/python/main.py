#!/usr/bin/env python3

"""
Gloo AI Completions Tutorial - Python

This example demonstrates how to use the Gloo AI Completions API
to generate text completions using the chat/completions endpoint.
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv("GLOO_API_KEY", "YOUR_API_KEY")
API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions"


def make_chat_completion_request(message="How can I be joyful in hard times?"):
    """Make a chat completion request."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
        "messages": [{"role": "user", "content": message}]
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making chat completion request: {e}")
        raise


def test_completions_api():
    """Test the completions API with multiple examples."""
    print("=== Gloo AI Completions API Test ===\n")

    test_messages = [
        "How can I be joyful in hard times?",
        "What are the benefits of a positive mindset?",
        "How do I build meaningful relationships?"
    ]

    try:
        for i, message in enumerate(test_messages, 1):
            print(f"Test {i}: {message}")

            completion = make_chat_completion_request(message)

            print("✓ Completion successful")
            print(f"Response: {completion['choices'][0]['message']['content'][:100]}...")
            print()

        print("=== All completion tests passed! ===")
        return True

    except Exception as e:
        print(f"✗ Completion test failed: {e}")
        return False


def main():
    """Main execution."""
    if API_KEY == "YOUR_API_KEY":
        print("Please set your GLOO_API_KEY environment variable")
        print("You can create a .env file with:")
        print("GLOO_API_KEY=your_api_key")
        return

    test_completions_api()


if __name__ == "__main__":
    main()
