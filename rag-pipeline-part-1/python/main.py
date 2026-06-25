#!/usr/bin/env python3
"""
Gloo AI RAG Pipeline - Part 1: Set Up the Pipeline (Python)

Uploads sample content to a publisher, enriches it with metadata,
and polls the Data Engine until the item is fully indexed.
"""

import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "")
PUBLISHER_ID = os.getenv("GLOO_PUBLISHER_ID", "")

API_ROOT = "https://platform.ai.gloo.com"
TOKEN_URL = f"{API_ROOT}/oauth2/token"
UPLOAD_URL = f"{API_ROOT}/ingestion/v2/files"
ITEM_METADATA_URL = f"{API_ROOT}/engine/v2/item"
ITEM_STATUS_URL = f"{API_ROOT}/engine/v2/items"

SAMPLE_FILE = Path(__file__).parent.parent / "sample_files" / "building-stronger-communities.md"
PRODUCER_ID = "rag-pipeline-part1-building-stronger-communities"

# Polling configuration: ingestion is asynchronous and typically
# takes several minutes (observed ~6 minutes for a small file).
POLL_INTERVAL_SECONDS = 15
POLL_TIMEOUT_SECONDS = 600

for name, value in [("GLOO_CLIENT_ID", CLIENT_ID),
                    ("GLOO_CLIENT_SECRET", CLIENT_SECRET),
                    ("GLOO_PUBLISHER_ID", PUBLISHER_ID)]:
    if not value:
        print(f"Error: {name} must be set. Copy .env.example to .env and fill in your values.")
        sys.exit(1)


class TokenManager:
    """Manages OAuth2 client-credentials token lifecycle."""

    def __init__(self) -> None:
        self._token_info: Dict[str, Any] = {}

    def get_token(self) -> str:
        """Return a valid access token, fetching a new one if needed."""
        if self._is_expired():
            response = requests.post(
                TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "client_credentials", "scope": "api/access"},
                auth=(CLIENT_ID, CLIENT_SECRET),
                timeout=30,
            )
            response.raise_for_status()
            self._token_info = response.json()
            self._token_info["expires_at"] = time.time() + self._token_info["expires_in"]
        return self._token_info["access_token"]

    def _is_expired(self) -> bool:
        expires_at = self._token_info.get("expires_at")
        return expires_at is None or time.time() > expires_at - 60


class PipelineSetup:
    """Uploads content, sets metadata, and verifies indexing."""

    def __init__(self, token_manager: TokenManager) -> None:
        self.token_manager = token_manager

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.token_manager.get_token()}"}

    def upload_file(self, file_path: Path) -> str:
        """Upload a single file; return its item ID.

        A stable producer_id makes re-runs idempotent: if the same content
        was already uploaded, the API reports it as a duplicate and we
        reuse the existing item instead of creating a new one.
        """
        with open(file_path, "rb") as f:
            response = requests.post(
                UPLOAD_URL,
                headers=self._headers(),
                params={"producer_id": PRODUCER_ID},
                files={"files": (file_path.name, f)},
                data={"publisher_id": PUBLISHER_ID},
                timeout=120,
            )
        response.raise_for_status()
        result = response.json()

        if result.get("ingesting"):
            item_id = result["ingesting"][0]
            print(f"  Queued for ingestion: {item_id}")
        elif result.get("duplicates"):
            item_id = result["duplicates"][0]
            print(f"  Already ingested (duplicate detected), reusing item: {item_id}")
        else:
            raise RuntimeError(f"Unexpected upload response: {result}")
        return item_id

    def set_metadata(self, item_id: str) -> None:
        """Attach descriptive metadata to the uploaded item."""
        metadata = {
            "publisher_id": PUBLISHER_ID,
            "item_id": item_id,
            "item_title": "Building Stronger Communities Through Service",
            "item_summary": "Practical guidance for starting and sustaining community service efforts.",
            "author": ["Gloo AI Docs Team"],
            "item_tags": ["community", "service", "rag-pipeline-series"],
        }
        response = requests.patch(
            ITEM_METADATA_URL,
            headers={**self._headers(), "Content-Type": "application/json"},
            json=metadata,
            timeout=30,
        )
        response.raise_for_status()
        print(f"  Metadata set: title, summary, author, {len(metadata['item_tags'])} tags")

    def get_item(self, item_id: str) -> Dict[str, Any]:
        """Fetch current item metadata, including ingestion status."""
        response = requests.get(
            f"{ITEM_STATUS_URL}/{item_id}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def wait_until_indexed(self, item_id: str) -> Dict[str, Any]:
        """Poll item status until indexing completes or the timeout elapses."""
        deadline = time.time() + POLL_TIMEOUT_SECONDS
        last_status: Optional[str] = None

        while time.time() < deadline:
            item = self.get_item(item_id)
            status = item.get("status", "unknown")

            if status != last_status:
                print(f"  Status: {status}")
                last_status = status

            # Terminal states (observed: CHUNKING while processing, COMPLETED when done).
            if status.upper() == "COMPLETED":
                return item
            if status.upper() in ("FAILED", "ERROR"):
                raise RuntimeError(f"Ingestion failed with status: {status}")

            time.sleep(POLL_INTERVAL_SECONDS)

        raise TimeoutError(
            f"Item {item_id} not indexed within {POLL_TIMEOUT_SECONDS}s (last status: {last_status})"
        )


def main() -> None:
    pipeline = PipelineSetup(TokenManager())

    print("Step 1: Uploading sample content...")
    item_id = pipeline.upload_file(SAMPLE_FILE)

    print("\nStep 2: Setting item metadata...")
    pipeline.set_metadata(item_id)

    print("\nStep 3: Verifying indexing (polling)...")
    item = pipeline.wait_until_indexed(item_id)

    print("\nPipeline content is indexed and ready.")
    print(f"  Item ID:  {item['item_id']}")
    print(f"  Title:    {item.get('item_title')}")
    print(f"  Author:   {', '.join(item.get('author') or [])}")
    print(f"  Tags:     {', '.join(item.get('item_tags') or [])}")
    print(f"  Status:   {item.get('status')}")
    print("\nNext: query this content with the Search API, or ask questions about it")
    print("with Grounded Completions (see the deep-dive recipes).")


if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.HTTPError as e:
        body = e.response.text[:500] if e.response is not None else ""
        print(f"API error: {e}\n{body}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
