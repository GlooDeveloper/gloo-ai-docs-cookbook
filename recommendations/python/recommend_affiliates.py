#!/usr/bin/env python3
"""
Gloo AI Recommendations API - Affiliate Referenced Items

Surfaces relevant items from across the Gloo affiliate publisher network,
enabling cross-publisher discovery for "Explore more resources" features.

Unlike the publisher-scoped endpoints, this endpoint does not require a
collection or tenant — it searches across the entire affiliate network.

Usage:
  python recommend_affiliates.py <query> [item_count]

Examples:
  python recommend_affiliates.py "How do I deal with anxiety?"
  python recommend_affiliates.py "parenting teenagers" 5
"""

import requests
import sys
from typing import Any
from auth import TokenManager, validate_credentials
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_URL,
    AFFILIATES_URL,
    DEFAULT_ITEM_COUNT,
)


class AffiliatesClient:
    """Handles affiliate referenced-item requests to the Gloo AI API."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    def get_referenced_items(self, query: str, item_count: int = DEFAULT_ITEM_COUNT) -> list[Any]:
        """
        Fetch relevant items from across the Gloo affiliate publisher network.

        No collection or tenant is required — results come from the full
        affiliate network, not a single publisher's library.

        Args:
            query: The user's query or topic
            item_count: Maximum number of items to return

        Returns:
            List of affiliate items from across the network
        """
        token = self.token_manager.ensure_valid_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": query,
            "item_count": item_count,
            "certainty_threshold": 0.75,
        }

        try:
            response = requests.post(
                AFFILIATES_URL,
                headers=headers,
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response is not None:
                print(f"Request failed with status {e.response.status_code}: {e.response.text}")
            raise Exception(f"Affiliates request failed: {e}")


class RecommendAffiliatesApp:
    """Main application class for affiliate recommendations."""

    def __init__(self):
        self.token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
        self.client = AffiliatesClient(self.token_manager)

    def run(self, query: str, item_count: int = DEFAULT_ITEM_COUNT) -> None:
        """Fetch and display affiliate network recommendations."""
        try:
            print(f"Fetching affiliate recommendations for: '{query}'")
            print(f"Searching across the Gloo affiliate network...")
            print(f"Requesting up to {item_count} items\n")

            items = self.client.get_referenced_items(query, item_count)

            if not items:
                print("No affiliate items found.")
                return

            print(f"Found {len(items)} item(s) from across the affiliate network:\n")

            for i, item in enumerate(items, 1):
                print(f"--- Item {i} ---")
                print(f"Title:     {item.get('item_title', 'N/A')}")

                authors = item.get("author", [])
                if authors:
                    print(f"Author:    {', '.join(authors)}")

                if item.get("tradition"):
                    print(f"Tradition: {item['tradition']}")

                if item.get("item_subtitle"):
                    print(f"Subtitle:  {item['item_subtitle']}")

                if item.get("item_url"):
                    print(f"URL:       {item['item_url']}")

                print()

        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

    def print_usage(self) -> None:
        print("Usage:")
        print("  python recommend_affiliates.py <query> [item_count]")
        print()
        print("Arguments:")
        print("  query       Topic or question to find resources for (required)")
        print("  item_count  Max items to return (optional, default: 5)")
        print()
        print("Examples:")
        print('  python recommend_affiliates.py "How do I deal with anxiety?"')
        print('  python recommend_affiliates.py "parenting teenagers" 5')


def main():
    validate_credentials(CLIENT_ID, CLIENT_SECRET)
    app = RecommendAffiliatesApp()

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
