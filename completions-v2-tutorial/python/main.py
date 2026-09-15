#!/usr/bin/env python3

"""
Gloo AI Completions V2 Tutorial - Python

This example demonstrates how to use the Gloo AI Completions V2 API
with its three routing strategies: auto-routing, model family selection,
and direct model selection.
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv("GLOO_API_KEY", "YOUR_API_KEY")
API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"


def make_v2_auto_routing(message, tradition="evangelical"):
    """Example 1: Auto-routing - Let Gloo AI select the optimal model."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": message}],
        "auto_routing": True,
        "tradition": tradition
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making auto-routing request: {e}")
        raise


def make_v2_model_family(message, model_family="anthropic"):
    """Example 2: Model family selection - Choose a provider family."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": message}],
        "model_family": model_family
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making model family request: {e}")
        raise


def make_v2_direct_model(message, model="gloo-anthropic-claude-sonnet-4.5"):
    """Example 3: Direct model selection - Specify an exact model."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": message}],
        "model": model,
        "temperature": 0.7,
        "max_tokens": 500
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making direct model request: {e}")
        raise


def test_completions_v2_api():
    """Test the Completions V2 API with all three routing strategies."""
    print("=== Gloo AI Completions V2 API Test ===\n")

    try:
        # Example 1: Auto-routing
        print("Example 1: Auto-Routing")
        print("Testing: How does the Old Testament connect to the New Testament?")
        result1 = make_v2_auto_routing("How does the Old Testament connect to the New Testament?")
        print(f"   Model used: {result1.get('model', 'N/A')}")
        print(f"   Routing: {result1.get('routing_mechanism', 'N/A')}")
        content1 = result1['choices'][0]['message']['content']
        print(f"   Response: {content1[:100]}...")
        print("   ✓ Auto-routing test passed\n")

        # Example 2: Model family selection
        print("Example 2: Model Family Selection")
        print("Testing: Draft a short sermon outline on forgiveness.")
        result2 = make_v2_model_family("Draft a short sermon outline on forgiveness.", "anthropic")
        print(f"   Model used: {result2.get('model', 'N/A')}")
        content2 = result2['choices'][0]['message']['content']
        print(f"   Response: {content2[:100]}...")
        print("   ✓ Model family test passed\n")

        # Example 3: Direct model selection
        print("Example 3: Direct Model Selection")
        print("Testing: Summarize the book of Romans in 3 sentences.")
        result3 = make_v2_direct_model("Summarize the book of Romans in 3 sentences.")
        print(f"   Model used: {result3.get('model', 'N/A')}")
        content3 = result3['choices'][0]['message']['content']
        print(f"   Response: {content3[:100]}...")
        print("   ✓ Direct model test passed\n")

        print("=== All Completions V2 tests passed! ===")
        return True

    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False


def main():
    """Main execution."""
    if API_KEY == "YOUR_API_KEY":
        print("Please set your GLOO_API_KEY environment variable")
        print("You can create a .env file with:")
        print("GLOO_API_KEY=your_api_key")
        return

    test_completions_v2_api()


if __name__ == "__main__":
    main()
