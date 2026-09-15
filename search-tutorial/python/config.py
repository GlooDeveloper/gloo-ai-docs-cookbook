import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _parse_env_int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def validate_api_key(api_key):
    """Validate that the API key is set. Exits if missing."""
    if not api_key:
        print("Error: GLOO_API_KEY must be set")
        print("Create a .env file with your API key:")
        print("GLOO_API_KEY=your_api_key_here")
        print("GLOO_TENANT=your_tenant_name_here")
        sys.exit(1)

API_KEY = os.getenv("GLOO_API_KEY", "")
TENANT = os.getenv("GLOO_TENANT", "your-tenant-name")

SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search"
COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"

PORT = _parse_env_int(os.getenv("PORT"), 3000)
RAG_MAX_TOKENS = _parse_env_int(os.getenv("RAG_MAX_TOKENS"), 3000)
RAG_CONTEXT_MAX_SNIPPETS = _parse_env_int(
    os.getenv("RAG_CONTEXT_MAX_SNIPPETS"), 5
)
RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = _parse_env_int(
    os.getenv("RAG_CONTEXT_MAX_CHARS_PER_SNIPPET"), 350
)
