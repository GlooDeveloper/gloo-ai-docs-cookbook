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
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GLOO_API_KEY = os.getenv("GLOO_API_KEY")
PUBLISHER_NAME = os.getenv("PUBLISHER_NAME", "Bezalel")

# API Endpoints
COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"
GROUNDED_URL = "https://platform.ai.gloo.com/ai/v2/grounded/chat/completions"


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
    if not GLOO_API_KEY:
        raise ValueError(
            "Missing API key. Set GLOO_API_KEY environment variable."
        )

    headers = {
        "Authorization": f"Bearer {GLOO_API_KEY}",
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
    if not GLOO_API_KEY:
        raise ValueError(
            "Missing API key. Set GLOO_API_KEY environment variable."
        )

    headers = {
        "Authorization": f"Bearer {GLOO_API_KEY}",
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
    Compare non-grounded vs publisher grounded responses.

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

    # Publisher grounded response
    print("🔹 STEP 2: GROUNDED on Your Publisher (Your Specific Content):")
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
    print("This demo shows a 2-step progression:")
    print("  1. Non-grounded (generic model knowledge)")
    print("  2. Grounded on your publisher (your specific content)")
    print("\nNote: For org-specific queries like Bezalel's hiring process,")
    print("step 1 may lack specific details, while step 2")
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
    print("✓ Step 2 (Publisher grounded): Your specific content, accurate and")
    print("  source-backed (sources_returned: true)")
    print("✓ Grounding on your publisher content eliminates hallucinations and")
    print("  provides accurate, organization-specific answers")
    print("\nNext Steps:")
    print("• Upload your own content to a Publisher in Gloo Studio")
    print("• Update PUBLISHER_NAME in .env to use your content")
    print("• Try both general and specific queries to see the differences!")
    print()


if __name__ == "__main__":
    main()
