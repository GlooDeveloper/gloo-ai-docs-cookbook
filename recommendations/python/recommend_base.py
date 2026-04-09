#!/usr/bin/env python3
"""
Gloo AI Recommendations API - Base Recommendations

Fetches publisher-scoped item recommendations with snippet metadata
but without snippet text — ideal for a clean recommendations list.

Usage:
  python recommend_base.py <query> [item_count]

Examples:
  python recommend_base.py "How do I deal with anxiety?"
  python recommend_base.py "parenting teenagers" 3
"""

import requests
import sys
from typing import Any
from auth import TokenManager, validate_credentials
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    COLLECTION,
    TENANT,
    TOKEN_URL,
    RECOMMENDATIONS_BASE_URL,
    DEFAULT_ITEM_COUNT,
)


class RecommendationsClient:
    """Handles base recommendation requests to the Gloo AI API."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    def get_base(self, query: str, item_count: int = DEFAULT_ITEM_COUNT) -> list[Any]:
        """
        Fetch publisher-scoped recommendations (metadata only, no snippet text).

        Args:
            query: The user's query or topic
            item_count: Maximum number of items to return

        Returns:
            List of recommended items with metadata
        """
        token = self.token_manager.ensure_valid_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": query,
            "collection": COLLECTION,
            "tenant": TENANT,
            "item_count": item_count,
            "certainty_threshold": 0.75,
        }

        try:
            response = requests.post(
                RECOMMENDATIONS_BASE_URL,
                headers=headers,
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response is not None:
                print(f"Request failed with status {e.response.status_code}: {e.response.text}")
            raise Exception(f"Recommendations request failed: {e}")


class RecommendBaseApp:
    """Main application class for base recommendations."""

    def __init__(self):
        self.token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
        self.client = RecommendationsClient(self.token_manager)

    def run(self, query: str, item_count: int = DEFAULT_ITEM_COUNT) -> None:
        """Fetch and display base recommendations."""
        try:
            print(f"Fetching recommendations for: '{query}'")
            print(f"Requesting up to {item_count} items\n")

            items = self.client.get_base(query, item_count)

            if not items:
                print("No recommendations found.")
                return

            print(f"Found {len(items)} recommended item(s):\n")

            for i, item in enumerate(items, 1):
                print(f"--- Item {i} ---")
                print(f"Title:  {item.get('item_title', 'N/A')}")

                authors = item.get("author", [])
                if authors:
                    print(f"Author: {', '.join(authors)}")

                # uuids holds the matched snippets with relevance scores
                uuids = item.get("uuids", [])
                if uuids:
                    top = uuids[0]
                    print(f"Relevance: {top.get('certainty', 0):.2f}")
                    if top.get("ai_title"):
                        print(f"Section:   {top['ai_title']}")
                    if top.get("item_summary"):
                        print(f"Summary:   {top['item_summary'][:200]}")

                if item.get("item_url"):
                    print(f"URL:    {item['item_url']}")

                print()

        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

    def print_usage(self) -> None:
        print("Usage:")
        print("  python recommend_base.py <query> [item_count]")
        print()
        print("Arguments:")
        print("  query       Topic or question to find recommendations for (required)")
        print("  item_count  Max items to return (optional, default: 5)")
        print()
        print("Examples:")
        print('  python recommend_base.py "How do I deal with anxiety?"')
        print('  python recommend_base.py "parenting teenagers" 3')


def main():
    validate_credentials(CLIENT_ID, CLIENT_SECRET)
    app = RecommendBaseApp()

    if len(sys.argv) < 2:
        app.print_usage()
        sys.exit(1)

    query = sys.argv[1]
    item_count = DEFAULT_ITEM_COUNT
    if len(sys.argv) > 2:
        try:
            item_count = max(1, min(int(sys.argv[2]), 50))
        except ValueError:
            print(f"Warning: invalid item_count '{sys.argv[2]}', using default {DEFAULT_ITEM_COUNT}")

    try:
        app.run(query, item_count)
    except KeyboardInterrupt:
        print("\nCancelled by user")
        sys.exit(0)


if __name__ == "__main__":
    main()
