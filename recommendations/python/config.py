import os
from dotenv import load_dotenv

load_dotenv()


def _parse_env_int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


API_KEY = os.getenv("GLOO_API_KEY", "")
TENANT = os.getenv("GLOO_TENANT", "your-tenant-name")
COLLECTION = os.getenv("GLOO_COLLECTION", "GlooProd")

RECOMMENDATIONS_BASE_URL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base"
RECOMMENDATIONS_VERBOSE_URL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose"
AFFILIATES_URL = "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items"

PORT = _parse_env_int(os.getenv("PORT"), 3000)
DEFAULT_ITEM_COUNT = _parse_env_int(os.getenv("DEFAULT_ITEM_COUNT"), 5)
