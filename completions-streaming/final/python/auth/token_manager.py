"""
Token manager for Gloo AI OAuth2 authentication.

Handles client credentials grant type with automatic token refresh.
"""

import os
import requests
from datetime import datetime, timedelta

# API Endpoints
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"

# Token state (module-level for simplicity)
access_token = None
token_expiry = None


def get_access_token() -> dict:
    """
    Retrieve an OAuth2 access token from Gloo AI.

    Uses the client credentials grant type with GLOO_CLIENT_ID and
    GLOO_CLIENT_SECRET from environment variables.

    Returns:
        dict: Token response containing access_token and expires_in

    Raises:
        ValueError: If credentials are not set
        Exception: If the token request fails
    """
    client_id = os.getenv("GLOO_CLIENT_ID")
    client_secret = os.getenv("GLOO_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError(
            "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET "
            "environment variables."
        )

    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }

    try:
        response = requests.post(TOKEN_URL, data=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to get access token: {str(e)}")


def ensure_valid_token() -> str:
    """
    Ensure we have a valid access token, refreshing if necessary.

    Caches the token at module level and refreshes it 5 minutes before
    expiry to avoid using an expired token mid-request.

    Returns:
        str: Valid access token
    """
    global access_token, token_expiry

    # Check if we need a new token
    if not access_token or not token_expiry or datetime.now() >= token_expiry:
        token_data = get_access_token()
        access_token = token_data["access_token"]
        # Set expiry with 5-minute buffer
        expires_in = token_data.get("expires_in", 3600)
        token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)

    return access_token
