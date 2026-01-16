#!/usr/bin/env python3

"""
Gloo AI Completions Tutorial - Python

This example demonstrates how to use the Gloo AI Completions API
to generate text completions using the chat/completions endpoint.
"""

import requests
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions"

# Global token storage
access_token_info = {}


def get_access_token():
    """Retrieve a new access token from the Gloo AI API."""
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"grant_type": "client_credentials", "scope": "api/access"}
    
    try:
        response = requests.post(TOKEN_URL, headers=headers, data=data, auth=(CLIENT_ID, CLIENT_SECRET))
        response.raise_for_status()
        
        token_data = response.json()
        token_data['expires_at'] = int(time.time()) + token_data['expires_in']
        
        return token_data
    except requests.exceptions.RequestException as e:
        print(f"Error getting access token: {e}")
        raise


def is_token_expired(token_info):
    """Check if the token is expired or close to expiring."""
    if not token_info or 'expires_at' not in token_info:
        return True
    return time.time() > (token_info['expires_at'] - 60)


def ensure_valid_token():
    """Ensure we have a valid access token."""
    global access_token_info
    if is_token_expired(access_token_info):
        print("Getting new access token...")
        access_token_info = get_access_token()
    return access_token_info['access_token']


def make_chat_completion_request(message="How can I be joyful in hard times?"):
    """Make a chat completion request."""
    token = ensure_valid_token()
    
    headers = {
        "Authorization": f"Bearer {token}",
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
    if CLIENT_ID == "YOUR_CLIENT_ID" or CLIENT_SECRET == "YOUR_CLIENT_SECRET":
        print("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables")
        print("You can create a .env file with:")
        print("GLOO_CLIENT_ID=your_client_id")
        print("GLOO_CLIENT_SECRET=your_client_secret")
        return
    
    test_completions_api()


if __name__ == "__main__":
    main()