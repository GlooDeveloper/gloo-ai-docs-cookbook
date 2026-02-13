#!/usr/bin/env python3
"""
Gloo AI Search API - Advanced Python Example

This script demonstrates advanced search features including:
- Filtering and pagination
- RAG (Retrieval Augmented Generation) helpers
- Integration with Completions V2 API
"""

import requests
import sys
from typing import Dict, Any, List, Optional
from auth import TokenManager, validate_credentials
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TENANT,
    TOKEN_URL,
    SEARCH_URL,
    COMPLETIONS_URL,
    RAG_MAX_TOKENS,
    RAG_CONTEXT_MAX_SNIPPETS,
    RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
)
from utils import normalize_limit

class AdvancedSearchClient:
    """Advanced search client with filtering and pagination capabilities."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    def search(
        self,
        query: str,
        limit: int = 10,
        sort_by: str = "relevance"
    ) -> Dict[str, Any]:
        """
        Perform an advanced semantic search query.

        Args:
            query: The search query string
            limit: Maximum number of results (10-100 recommended)
            sort_by: Sort method - "relevance" or "certainty"

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
            results = response.json()

            # Sort results if requested
            if sort_by == "certainty" and results.get('data'):
                results['data'] = sorted(
                    results['data'],
                    key=lambda x: x.get('metadata', {}).get('certainty', 0),
                    reverse=True
                )

            return results

        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                print(f"Search failed with status {e.response.status_code}: {e.response.text}")
            raise Exception(f"Search request failed: {e}")

    def filter_by_content_type(
        self,
        results: Dict[str, Any],
        content_types: List[str]
    ) -> Dict[str, Any]:
        """
        Filter search results by content type.

        Args:
            results: Search results from the API
            content_types: List of content types to include (e.g., ["Article", "Video"])

        Returns:
            Filtered results dictionary
        """
        if not results.get('data'):
            return results

        filtered_data = [
            result for result in results['data']
            if result.get('properties', {}).get('type') in content_types
        ]

        return {
            **results,
            'data': filtered_data
        }


class RAGHelper:
    """Helper class for Retrieval Augmented Generation workflows."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    @staticmethod
    def extract_snippets(
        results: Dict[str, Any],
        max_snippets: int = 5,
        max_chars_per_snippet: int = 500
    ) -> List[Dict[str, str]]:
        """
        Extract and format snippets from search results for RAG.

        Args:
            results: Search results from the API
            max_snippets: Maximum number of snippets to extract
            max_chars_per_snippet: Maximum characters per snippet

        Returns:
            List of formatted snippet dictionaries
        """
        if not results.get('data'):
            return []

        snippets = []
        for result in results['data'][:max_snippets]:
            props = result.get('properties', {})
            snippet_text = props.get('snippet', '')[:max_chars_per_snippet]

            snippets.append({
                'text': snippet_text,
                'title': props.get('item_title', 'N/A'),
                'type': props.get('type', 'N/A'),
                'relevance': result.get('metadata', {}).get('certainty', 0)
            })

        return snippets

    @staticmethod
    def format_context_for_llm(snippets: List[Dict[str, str]]) -> str:
        """
        Format extracted snippets as context for LLM.

        Args:
            snippets: List of snippet dictionaries

        Returns:
            Formatted context string
        """
        context_parts = []
        for i, snippet in enumerate(snippets, 1):
            context_parts.append(
                f"[Source {i}: {snippet['title']} ({snippet['type']})]\n{snippet['text']}\n"
            )

        return "\n---\n".join(context_parts)

    def generate_with_context(
        self,
        query: str,
        context: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Call Completions V2 API with custom context.

        Args:
            query: User's question
            context: Formatted context from search results
            system_prompt: Optional custom system prompt

        Returns:
            Generated response text
        """
        token = self.token_manager.ensure_valid_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Default system prompt if none provided
        if not system_prompt:
            system_prompt = (
                "You are a helpful assistant. Answer the user's question based on the "
                "provided context. If the context doesn't contain relevant information, "
                "say so honestly."
            )

        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {query}"
            }
        ]

        payload = {
            "messages": messages,
            "auto_routing": True,
            "max_tokens": RAG_MAX_TOKENS
        }

        try:
            response = requests.post(
                COMPLETIONS_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            result = response.json()

            return result.get('choices', [{}])[0].get('message', {}).get('content', '')

        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                print(f"Completions API failed: {e.response.text}")
            raise Exception(f"Completions request failed: {e}")


class AdvancedSearchApp:
    """Application demonstrating advanced search features."""

    def __init__(self):
        self.token_manager = TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
        self.search_client = AdvancedSearchClient(self.token_manager)
        self.rag_helper = RAGHelper(self.token_manager)

    def filtered_search(
        self,
        query: str,
        content_types: List[str],
        limit: int = 10
    ) -> None:
        """Execute a search with content type filtering."""
        try:
            print(f"Searching for: '{query}'")
            print(f"Content types: {', '.join(content_types)}")
            print(f"Limit: {limit}\n")

            # Perform search
            results = self.search_client.search(query, limit)

            # Apply filter
            filtered_results = self.search_client.filter_by_content_type(
                results,
                content_types
            )

            if not filtered_results.get('data'):
                print("No results found matching filters.")
                return

            print(f"Found {len(filtered_results['data'])} results:\n")

            for i, result in enumerate(filtered_results['data'], 1):
                props = result.get('properties', {})
                print(f"{i}. {props.get('item_title', 'N/A')} ({props.get('type', 'N/A')})")

        except Exception as e:
            print(f"Filtered search failed: {e}")
            sys.exit(1)

    def rag_search(self, query: str, limit: int = 5) -> None:
        """Execute a search and use results for RAG with Completions API."""
        try:
            print(f"RAG Search for: '{query}'\n")

            # Step 1: Search for relevant content
            print("Step 1: Searching for relevant content...")
            results = self.search_client.search(query, limit)

            if not results.get('data'):
                print("No results found.")
                return

            print(f"Found {len(results['data'])} results\n")

            # Step 2: Extract and format snippets
            print("Step 2: Extracting snippets...")
            snippet_limit = min(limit, RAG_CONTEXT_MAX_SNIPPETS)
            snippets = self.rag_helper.extract_snippets(
                results,
                max_snippets=snippet_limit,
                max_chars_per_snippet=RAG_CONTEXT_MAX_CHARS_PER_SNIPPET
            )
            context = self.rag_helper.format_context_for_llm(snippets)

            print(f"Extracted {len(snippets)} snippets\n")

            # Step 3: Generate response with context
            print("Step 3: Generating response with context...\n")
            response = self.rag_helper.generate_with_context(query, context)

            print("=== Generated Response ===")
            print(response)
            print("\n=== Sources Used ===")
            for snippet in snippets:
                print(f"- {snippet['title']} ({snippet['type']})")

        except Exception as e:
            print(f"RAG search failed: {e}")
            sys.exit(1)

    def print_usage(self) -> None:
        """Print usage information."""
        print("Usage:")
        print("  python search_advanced.py filter <query> <types> [limit]")
        print("  python search_advanced.py rag <query> [limit]")
        print()
        print("Commands:")
        print("  filter    Search with content type filtering")
        print("  rag       Search and generate response using RAG")
        print()
        print("Examples:")
        print('  python search_advanced.py filter "purpose" "Article,Video" 10')
        print('  python search_advanced.py rag "How can I know my purpose?" 5')


def main():
    """Main entry point."""
    validate_credentials(CLIENT_ID, CLIENT_SECRET)
    app = AdvancedSearchApp()

    if len(sys.argv) < 3:
        app.print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()
    query = sys.argv[2]

    try:
        if command == "filter":
            if len(sys.argv) < 4:
                print("Error: Content types required for filter command")
                app.print_usage()
                sys.exit(1)

            types = sys.argv[3].split(',')
            limit = normalize_limit(sys.argv[4], 10) if len(sys.argv) > 4 else 10
            app.filtered_search(query, types, limit)

        elif command == "rag":
            limit = normalize_limit(sys.argv[3], 5) if len(sys.argv) > 3 else 5
            app.rag_search(query, limit)

        else:
            print(f"Error: Unknown command '{command}'")
            app.print_usage()
            sys.exit(1)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
