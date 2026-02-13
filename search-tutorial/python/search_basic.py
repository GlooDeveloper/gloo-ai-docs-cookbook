#!/usr/bin/env python3
"""
Gloo AI Search API - Basic Python Example

This script demonstrates how to use the Gloo AI Search API
to perform semantic search on your ingested content.
"""

import requests
import sys
from typing import Dict, Any
from auth import TokenManager, validate_credentials
from config import CLIENT_ID, CLIENT_SECRET, TENANT, TOKEN_URL, SEARCH_URL
from utils import normalize_limit


class SearchClient:
    """Handles search requests to the Gloo AI Search API."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    def search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Perform a semantic search query.

        Args:
            query: The search query string
            limit: Maximum number of results to return (10-100 recommended)

        Returns:
            Dictionary containing search results
        """
        token = self.token_manager.ensure_valid_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        payload = {
            "query": query,
            "collection": "GlooProd",
            "tenant": TENANT,
            "limit": limit,
            "certainty": 0.5
        }

        try:
            response = requests.post(
                SEARCH_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                print(f"Search failed with status {e.response.status_code}: {e.response.text}")
            raise Exception(f"Search request failed: {e}")


class SearchApp:
    """Main application class for search operations."""

    def __init__(self):
        self.token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
        self.search_client = SearchClient(self.token_manager)

    def basic_search(self, query: str, limit: int = 10) -> None:
        """
        Perform a basic search and display results.

        Args:
            query: The search query
            limit: Number of results to return
        """
        try:
            print(f"Searching for: '{query}'")
            print(f"Limit: {limit} results\n")

            results = self.search_client.search(query, limit)

            if not results.get('data'):
                print("No results found.")
                return

            print(f"Found {len(results['data'])} results:\n")

            for i, result in enumerate(results['data'], 1):
                props = result.get('properties', {})
                metadata = result.get('metadata', {})

                print(f"--- Result {i} ---")
                print(f"Title: {props.get('item_title', 'N/A')}")
                print(f"Type: {props.get('type', 'N/A')}")
                print(f"Author: {', '.join(props.get('author', ['N/A']))}")
                print(f"Relevance Score: {metadata.get('certainty', 0):.4f}")

                # Display snippet (first 200 chars)
                snippet = props.get('snippet', '')
                if snippet:
                    print(f"Snippet: {snippet[:200]}...")

                print()

        except Exception as e:
            print(f"Search failed: {e}")
            sys.exit(1)

    def print_usage(self) -> None:
        """Print usage information."""
        print("Usage:")
        print("  python search_basic.py <query> [limit]")
        print()
        print("Arguments:")
        print("  query   Search query string (required)")
        print("  limit   Number of results to return (optional, default: 10)")
        print()
        print("Examples:")
        print('  python search_basic.py "How can I know my purpose?"')
        print('  python search_basic.py "purpose" 5')


def main():
    """Main entry point."""
    validate_credentials(CLIENT_ID, CLIENT_SECRET)
    app = SearchApp()

    if len(sys.argv) < 2:
        app.print_usage()
        sys.exit(1)

    query = sys.argv[1]
    limit = normalize_limit(sys.argv[2], 10) if len(sys.argv) > 2 else 10

    try:
        app.basic_search(query, limit)
    except KeyboardInterrupt:
        print("\nSearch cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
