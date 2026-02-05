#!/usr/bin/env python3
"""
Grounded Completions Recipe - Python Implementation

This script demonstrates the difference between non-grounded and grounded
completions using Gloo AI's RAG (Retrieval-Augmented Generation) capabilities.

It compares responses from a standard completion (which may hallucinate)
against a grounded completion (which uses your actual content).
"""

import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GLOO_CLIENT_ID = os.getenv("GLOO_CLIENT_ID")
GLOO_CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET")
PUBLISHER_NAME = os.getenv("PUBLISHER_NAME", "Bezalel")

# API Endpoints
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"
GROUNDED_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions/grounded"

# Token management
access_token = None
token_expiry = None


def get_access_token():
    """
    Retrieve an OAuth2 access token from Gloo AI.

    Returns:
        dict: Token response containing access_token and expires_in
    """
    if not GLOO_CLIENT_ID or not GLOO_CLIENT_SECRET:
        raise ValueError(
            "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET "
            "environment variables."
        )

    payload = {
        "grant_type": "client_credentials",
        "client_id": GLOO_CLIENT_ID,
        "client_secret": GLOO_CLIENT_SECRET
    }

    try:
        response = requests.post(TOKEN_URL, data=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to get access token: {str(e)}")


def ensure_valid_token():
    """
    Ensure we have a valid access token, refreshing if necessary.

    Returns:
        str: Valid access token
    """
    global access_token, token_expiry

    # Check if we need a new token
    if not access_token or not token_expiry or datetime.now() >= token_expiry:
        token_data = get_access_token()
        access_token = token_data["access_token"]
        # Set expiry with 5 minute buffer
        expires_in = token_data.get("expires_in", 3600)
        token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)

    return access_token


def make_non_grounded_request(query):
    """
    Make a standard V2 completion request WITHOUT grounding.

    This uses the model's general knowledge and may produce generic
    or potentially inaccurate responses about your specific content.

    Args:
        query (str): The user's question

    Returns:
        dict: API response
    """
    token = ensure_valid_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": query}],
        "auto_routing": True,
        "max_tokens": 500
    }

    try:
        response = requests.post(COMPLETIONS_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Non-grounded request failed: {str(e)}")


def make_default_grounded_request(query, sources_limit=3):
    """
    Make a grounded completion request using Gloo's default dataset.

    This retrieves relevant content from Gloo's default faith-based content
    before generating a response. Good for general religious questions,
    but won't have specific information about your organization.

    Args:
        query (str): The user's question
        sources_limit (int): Maximum number of sources to use (default: 3)

    Returns:
        dict: API response with sources_returned flag
    """
    token = ensure_valid_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": query}],
        "auto_routing": True,
        "sources_limit": sources_limit,
        "max_tokens": 500
    }

    try:
        response = requests.post(GROUNDED_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Default grounded request failed: {str(e)}")


def make_publisher_grounded_request(query, publisher_name, sources_limit=3):
    """
    Make a grounded completion request WITH RAG on your specific publisher.

    This retrieves relevant content from your publisher before generating
    a response, resulting in accurate, source-backed answers specific to
    your organization.

    Args:
        query (str): The user's question
        publisher_name (str): Name of the publisher in Gloo Studio
        sources_limit (int): Maximum number of sources to use (default: 3)

    Returns:
        dict: API response with sources_returned flag
    """
    token = ensure_valid_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [{"role": "user", "content": query}],
        "auto_routing": True,
        "rag_publisher": publisher_name,
        "sources_limit": sources_limit,
        "max_tokens": 500
    }

    try:
        response = requests.post(GROUNDED_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Publisher grounded request failed: {str(e)}")


def compare_responses(query, publisher_name):
    """
    Compare non-grounded vs default grounded vs publisher grounded responses.

    This is the main demo function that shows the progression from generic
    responses to organization-specific answers through RAG.

    Args:
        query (str): The question to ask
        publisher_name (str): Name of the publisher in Gloo Studio
    """
    print(f"\n{'='*80}")
    print(f"Query: {query}")
    print('='*80)

    # Non-grounded response
    print("\n🔹 STEP 1: NON-GROUNDED Response (Generic Model Knowledge):")
    print("-" * 80)
    try:
        non_grounded = make_non_grounded_request(query)
        content = non_grounded['choices'][0]['message']['content']
        print(content)
        print(f"\n📊 Metadata:")
        print(f"   Sources used: {non_grounded.get('sources_returned', False)}")
        print(f"   Model: {non_grounded.get('model', 'N/A')}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

    print(f"\n{'='*80}\n")

    # Default grounded response
    print("🔹 STEP 2: GROUNDED on Default Dataset (Gloo's Faith-Based Content):")
    print("-" * 80)
    try:
        default_grounded = make_default_grounded_request(query)
        content = default_grounded['choices'][0]['message']['content']
        print(content)
        print(f"\n📊 Metadata:")
        print(f"   Sources used: {default_grounded.get('sources_returned', False)}")
        print(f"   Model: {default_grounded.get('model', 'N/A')}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

    print(f"\n{'='*80}\n")

    # Publisher grounded response
    print("🔹 STEP 3: GROUNDED on Your Publisher (Your Specific Content):")
    print("-" * 80)
    try:
        publisher_grounded = make_publisher_grounded_request(query, publisher_name)
        content = publisher_grounded['choices'][0]['message']['content']
        print(content)
        print(f"\n📊 Metadata:")
        print(f"   Sources used: {publisher_grounded.get('sources_returned', False)}")
        print(f"   Model: {publisher_grounded.get('model', 'N/A')}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

    print(f"\n{'='*80}\n")


def main():
    """
    Run the grounded completions comparison demo.

    Tests multiple queries to demonstrate the value of RAG in reducing
    hallucinations and providing accurate, source-backed responses.
    """
    print("\n" + "="*80)
    print("  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses")
    print("="*80)
    print(f"\nPublisher: {PUBLISHER_NAME}")
    print("This demo shows a 3-step progression:")
    print("  1. Non-grounded (generic model knowledge)")
    print("  2. Grounded on default dataset (Gloo's faith-based content)")
    print("  3. Grounded on your publisher (your specific content)")
    print("\nNote: For org-specific queries like Bezalel's hiring process,")
    print("both steps 1 and 2 may lack specific details, while step 3")
    print("provides accurate, source-backed answers from your content.\n")

    # Test queries that demonstrate clear differences
    queries = [
        "What is Bezalel Ministries' hiring process?",
        "What educational resources does Bezalel Ministries provide?",
        "Describe Bezalel's research methodology for creating artwork."
    ]

    for i, query in enumerate(queries, 1):
        print(f"\n{'#'*80}")
        print(f"# COMPARISON {i} of {len(queries)}")
        print(f"{'#'*80}")
        compare_responses(query, PUBLISHER_NAME)

        # Pause between comparisons for readability
        if i < len(queries):
            input("Press Enter to continue to next comparison...")

    print("\n" + "="*80)
    print("  Demo Complete!")
    print("="*80)
    print("\nKey Takeaways:")
    print("✓ Step 1 (Non-grounded): Generic model knowledge, may hallucinate")
    print("✓ Step 2 (Default grounded): Uses Gloo's faith-based content, better for")
    print("  general questions but lacks org-specific details")
    print("✓ Step 3 (Publisher grounded): Your specific content, accurate and")
    print("  source-backed (sources_returned: true)")
    print("✓ Grounding on relevant content is key - generic grounding may not help")
    print("  for organization-specific queries")
    print("\nNext Steps:")
    print("• Upload your own content to a Publisher in Gloo Studio")
    print("• Update PUBLISHER_NAME in .env to use your content")
    print("• Try both general and specific queries to see the differences!")
    print()


if __name__ == "__main__":
    main()
