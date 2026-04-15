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
COLLECTION = os.getenv("GLOO_COLLECTION", "GlooProd")

TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
RECOMMENDATIONS_BASE_URL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base"
RECOMMENDATIONS_VERBOSE_URL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose"
AFFILIATES_URL = "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items"

PORT = _parse_env_int(os.getenv("PORT"), 3000)
DEFAULT_ITEM_COUNT = _parse_env_int(os.getenv("DEFAULT_ITEM_COUNT"), 5)
