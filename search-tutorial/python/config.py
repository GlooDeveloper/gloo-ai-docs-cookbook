import os
from dotenv import load_dotenv

load_dotenv()


def _parse_env_int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback

CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
TENANT = os.getenv("GLOO_TENANT", "your-tenant-name")

TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search"
COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

PORT = _parse_env_int(os.getenv("PORT"), 3000)
RAG_MAX_TOKENS = _parse_env_int(os.getenv("RAG_MAX_TOKENS"), 3000)
RAG_CONTEXT_MAX_SNIPPETS = _parse_env_int(
    os.getenv("RAG_CONTEXT_MAX_SNIPPETS"), 5
)
RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = _parse_env_int(
    os.getenv("RAG_CONTEXT_MAX_CHARS_PER_SNIPPET"), 350
)
