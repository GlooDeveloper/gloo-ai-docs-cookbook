#!/usr/bin/env python3
"""
Gloo AI RAG Pipeline - Part 2: Content Lifecycle (Python)

Seeds a small set of items, then demonstrates the content lifecycle:
update a single item, bulk-edit several items, verify the changes, and
delete the items (cleanup).

Every mutation is scoped to the exact item IDs this recipe created —
captured from the upload responses — so it never touches other content
in the publisher.
"""

import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

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
ITEM_URL = f"{API_ROOT}/engine/v2/item"          # single-item update (PATCH)
ITEMS_URL = f"{API_ROOT}/engine/v2/items"        # bulk patch (PATCH), delete (DELETE)

SAMPLE_DIR = Path(__file__).parent.parent / "sample_files"

# The items this recipe manages. Producer IDs are stable identifiers you assign;
# here they share a prefix unique to this recipe.
SEED_ITEMS = [
    {
        "file": "volunteer-onboarding.md",
        "producer_id": "rag-pipeline-part2-volunteer-onboarding",
        "item_title": "Onboarding New Volunteers",
        "item_summary": "How a warm, organized welcome turns newcomers into committed volunteers.",
        "author": ["Gloo AI Docs Team"],
        "item_tags": ["volunteers", "rag-pipeline-series"],
    },
    {
        "file": "measuring-community-impact.md",
        "producer_id": "rag-pipeline-part2-measuring-impact",
        "item_title": "Measuring Community Impact",
        "item_summary": "Why measuring outcomes, not activity, sustains community programs.",
        "author": ["Gloo AI Docs Team"],
        "item_tags": ["measurement", "rag-pipeline-series"],
    },
    {
        "file": "sustaining-engagement.md",
        "producer_id": "rag-pipeline-part2-sustaining-engagement",
        "item_title": "Sustaining Long-Term Engagement",
        "item_summary": "Practices that keep volunteers engaged through the long haul.",
        "author": ["Gloo AI Docs Team"],
        "item_tags": ["engagement", "rag-pipeline-series"],
    },
]

# Polling configuration: ingestion is asynchronous and typically
# takes several minutes (observed ~6 minutes for a small file).
POLL_INTERVAL_SECONDS = 15
POLL_TIMEOUT_SECONDS = 600

# Edits succeed immediately, but the read path is eventually consistent:
# a freshly patched item can take a few seconds to reflect the change on a
# subsequent GET. Verification re-fetches until the change is visible.
VERIFY_ATTEMPTS = 20
VERIFY_INTERVAL_SECONDS = 3

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


class ContentLifecycle:
    """Seeds content and performs scoped lifecycle operations on it."""

    def __init__(self, token_manager: TokenManager) -> None:
        self.token_manager = token_manager

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.token_manager.get_token()}"}

    def _json_headers(self) -> Dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def upload_file(self, file_path: Path, producer_id: str) -> str:
        """Upload a single file under a stable producer ID; return its item ID.

        The upload response is the authoritative source of the item ID — keep
        it and use it for every later operation.
        """
        with open(file_path, "rb") as f:
            response = requests.post(
                UPLOAD_URL,
                headers=self._headers(),
                params={"producer_id": producer_id},
                files={"files": (file_path.name, f)},
                data={"publisher_id": PUBLISHER_ID},
                timeout=120,
            )
        response.raise_for_status()
        result = response.json()
        item_id = (result.get("ingesting") or result.get("duplicates") or [None])[0]
        if not item_id:
            raise RuntimeError(f"Unexpected upload response: {result}")
        return item_id

    def set_metadata(self, item_id: str, fields: Dict[str, Any]) -> None:
        """Set metadata on a single item via PATCH /engine/v2/item."""
        payload = {"publisher_id": PUBLISHER_ID, "item_id": item_id, **fields}
        response = requests.patch(
            ITEM_URL, headers=self._json_headers(), json=payload, timeout=30
        )
        response.raise_for_status()

    def get_item(self, item_id: str) -> Dict[str, Any]:
        """Fetch current item metadata, including ingestion status."""
        response = requests.get(
            f"{ITEMS_URL}/{item_id}", headers=self._headers(), timeout=30
        )
        response.raise_for_status()
        return response.json()

    def item_exists(self, item_id: str) -> bool:
        """Return True while the item can still be fetched (False once deleted).

        GET is authoritative for deletion: it returns 404 as soon as an item is
        gone.
        """
        response = requests.get(
            f"{ITEMS_URL}/{item_id}", headers=self._headers(), timeout=30
        )
        if response.status_code == 404:
            return False
        response.raise_for_status()
        return True

    def wait_until_indexed(self, item_ids: List[str]) -> None:
        """Poll until every item reaches COMPLETED or the timeout elapses."""
        deadline = time.time() + POLL_TIMEOUT_SECONDS
        pending = set(item_ids)

        while pending and time.time() < deadline:
            for item_id in list(pending):
                status = self.get_item(item_id).get("status", "unknown")
                if status.upper() == "COMPLETED":
                    pending.discard(item_id)
                elif status.upper() in ("FAILED", "ERROR"):
                    raise RuntimeError(f"Ingestion failed for {item_id}: {status}")
            if pending:
                print(f"  Waiting for {len(pending)} item(s) to finish indexing...")
                time.sleep(POLL_INTERVAL_SECONDS)

        if pending:
            raise TimeoutError(f"Items not indexed within {POLL_TIMEOUT_SECONDS}s: {pending}")

    def bulk_patch(self, item_ids: List[str], ops: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Apply patch operations to a specific set of items.

        Scoped by item_ids in the filter, so only the listed items are touched.
        """
        payload = {"filter": {"item_ids": item_ids}, "ops": ops}
        response = requests.patch(
            ITEMS_URL,
            headers=self._json_headers(),
            params={"publisher_id": PUBLISHER_ID},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def delete_items(self, item_ids: List[str]) -> Dict[str, Any]:
        """Delete a specific set of items by ID."""
        response = requests.delete(
            ITEMS_URL,
            headers=self._json_headers(),
            json={"item_ids": item_ids},
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def get_item_with_tag(self, item_id: str, tag: str) -> Dict[str, Any]:
        """Re-fetch an item until the given tag is visible (read-after-write retry)."""
        item = self.get_item(item_id)
        for _ in range(VERIFY_ATTEMPTS):
            if tag in (item.get("item_tags") or []):
                return item
            time.sleep(VERIFY_INTERVAL_SECONDS)
            item = self.get_item(item_id)
        return item

    def wait_until_deleted(self, item_id: str) -> bool:
        """Re-check until the item is gone (GET returns 404), or attempts run out."""
        for _ in range(VERIFY_ATTEMPTS):
            if not self.item_exists(item_id):
                return True
            time.sleep(VERIFY_INTERVAL_SECONDS)
        return False


def main() -> None:
    lifecycle = ContentLifecycle(TokenManager())

    print("Step 1: Seeding sample content...")
    # Capture each item's ID from its upload response — this is the authoritative
    # handle we scope every later operation to.
    mapping: Dict[str, str] = {}
    for item in SEED_ITEMS:
        item_id = lifecycle.upload_file(SAMPLE_DIR / item["file"], item["producer_id"])
        metadata = {k: item[k] for k in ("item_title", "item_summary", "author", "item_tags")}
        lifecycle.set_metadata(item_id, metadata)
        mapping[item["producer_id"]] = item_id
        print(f"  Uploaded {item['producer_id']} -> {item_id}")
    item_ids = list(mapping.values())
    print("  Waiting for ingestion to complete (this can take a few minutes)...")
    lifecycle.wait_until_indexed(item_ids)
    print("  All seed items indexed.")

    print("\nStep 2: Updating a single item...")
    target_producer = "rag-pipeline-part2-volunteer-onboarding"
    lifecycle.set_metadata(mapping[target_producer], {
        "item_title": "Onboarding New Volunteers: A First-Day Playbook",
        "item_summary": "A practical first-day checklist for welcoming and retaining new volunteers.",
    })
    print(f"  Updated title and summary for {target_producer}")

    print("\nStep 3: Bulk-editing all seeded items...")
    review_tag = "reviewed-q2-2026"
    result = lifecycle.bulk_patch(item_ids, ops=[
        {"op": "append", "field": "item_tags", "value": [review_tag]},
        {"op": "replace", "field": "author", "value": ["Community Programs Team"]},
    ])
    print(f"  Matched {result['total_matched']}, patched {result['total_patched']}, "
          f"failed {result['total_failed']}")

    print("\nStep 4: Verifying changes...")
    for producer_id, item_id in mapping.items():
        item = lifecycle.get_item_with_tag(item_id, review_tag)
        print(f"  {item['item_title']}")
        print(f"    author: {', '.join(item.get('author') or [])}")
        print(f"    tags:   {', '.join(item.get('item_tags') or [])}")

    print("\nStep 5: Deleting items (cleanup)...")
    deletion = lifecycle.delete_items(item_ids)
    print(f"  Requested {deletion['total_requested']}, deleted {deletion['total_deleted']}, "
          f"failed {deletion['total_failed']}")
    all_gone = all(lifecycle.wait_until_deleted(item_id) for item_id in item_ids)
    print(f"  All items confirmed deleted: {all_gone}")
    print("\nLifecycle complete. The publisher is back to its pre-recipe state.")


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
