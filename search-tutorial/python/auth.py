"""
Gloo AI Search API - Authentication

OAuth2 token management for Gloo AI API authentication.
"""

import requests
import sys
import time
from typing import Dict, Any


def validate_credentials(client_id: str, client_secret: str):
    """Validate that required credentials are set. Exits if missing."""
    if client_id in ("YOUR_CLIENT_ID", "", None) or client_secret in ("YOUR_CLIENT_SECRET", "", None):
        print("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
        print("Create a .env file with your credentials:")
        print("GLOO_CLIENT_ID=your_client_id_here")
        print("GLOO_CLIENT_SECRET=your_client_secret_here")
        print("GLOO_TENANT=your_tenant_name_here")
        sys.exit(1)


class TokenManager:
    """Manages OAuth2 token lifecycle for API authentication."""

    def __init__(self, client_id: str, client_secret: str, token_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self.access_token_info: Dict[str, Any] = {}

    def get_access_token(self) -> Dict[str, Any]:
        """Retrieves a new access token from the OAuth2 endpoint."""
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {"grant_type": "client_credentials", "scope": "api/access"}

        try:
            response = requests.post(
                self.token_url,
                headers=headers,
                data=data,
                auth=(self.client_id, self.client_secret),
                timeout=30
            )
            response.raise_for_status()

            token_data = response.json()
            token_data['expires_at'] = int(time.time()) + token_data['expires_in']
            self.access_token_info = token_data
            return token_data

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to obtain access token: {e}")

    def is_token_expired(self) -> bool:
        """Checks if the token is expired or close to expiring."""
        if not self.access_token_info or 'expires_at' not in self.access_token_info:
            return True
        return time.time() > (self.access_token_info['expires_at'] - 60)  # 60 second buffer

    def ensure_valid_token(self) -> str:
        """Ensure we have a valid access token and return it."""
        if self.is_token_expired():
            self.get_access_token()
        return self.access_token_info['access_token']
