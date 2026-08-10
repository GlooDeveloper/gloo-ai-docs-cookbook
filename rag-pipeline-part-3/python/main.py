#!/usr/bin/env python3
"""
Gloo AI RAG Pipeline - Part 3: Verification, Error Handling & Resilience (Python)

Builds a small resilient API client and demonstrates three production
concerns against the Gloo AI Data Engine:

  1. Interpreting structured API error responses (status, code, message)
  2. Retrying transient failures with exponential backoff
  3. Verifying ingestion health, handling missing items gracefully

There are no monitoring or health-check endpoints — resilience here is built
from the same item APIs used in Parts 1 and 2, plus disciplined error handling.
"""

import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
API_KEY = os.getenv("GLOO_API_KEY", "")
PUBLISHER_ID = os.getenv("GLOO_PUBLISHER_ID", "")

API_ROOT = "https://platform.ai.gloo.com"
UPLOAD_URL = f"{API_ROOT}/ingestion/v2/files"
ITEMS_URL = f"{API_ROOT}/engine/v2/items"

SAMPLE_DIR = Path(__file__).parent.parent / "sample_files"
SEED_ITEMS = [
    ("strengthening-feedback-loops.md", "rag-pipeline-part3-feedback-loops"),
    ("learning-from-incidents.md", "rag-pipeline-part3-incident-reviews"),
]

# Retry policy: only transient failures are retried. Client errors (400, 401,
# 403, 404, 422) are bugs in the request, not blips, so they fail fast.
RETRYABLE_STATUSES = {500, 502, 503, 504}
MAX_RETRIES = 4
BASE_DELAY_SECONDS = 1.0

# Ingestion polling (asynchronous; ~6 minutes for a small file).
POLL_INTERVAL_SECONDS = 15
POLL_TIMEOUT_SECONDS = 600

for name, value in [("GLOO_API_KEY", API_KEY),
                    ("GLOO_PUBLISHER_ID", PUBLISHER_ID)]:
    if not value:
        print(f"Error: {name} must be set. Copy .env.example to .env and fill in your values.")
        sys.exit(1)


class ApiError(Exception):
    """A normalized API error: HTTP status (None for network failures), a
    machine-readable code, and a human-readable message."""

    def __init__(self, status: Optional[int], code: Optional[str], message: str) -> None:
        super().__init__(f"[{status} {code}] {message}")
        self.status = status
        self.code = code
        self.message = message

    def is_retryable(self) -> bool:
        # Network failures (status None) and transient server statuses are retryable.
        return self.status is None or self.status in RETRYABLE_STATUSES


class ResilientClient:
    """A thin HTTP client with structured error parsing and retry-with-backoff."""

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    @staticmethod
    def _parse_error(response: requests.Response) -> Tuple[Optional[str], str]:
        """Extract (code, message) from the API's error shapes.

        The Data Engine uses a few shapes: {"detail": {"code", "message"}},
        {"detail": "..."} , and {"error", "message"}. Normalize them all.
        """
        try:
            body = response.json()
        except ValueError:
            return None, response.text[:200] or response.reason

        if isinstance(body, dict):
            detail = body.get("detail")
            if isinstance(detail, dict):
                return detail.get("code"), detail.get("message") or response.reason
            if isinstance(detail, str):
                return None, detail
            if "error" in body or "message" in body:
                return body.get("error"), body.get("message") or response.reason
        return None, str(body)[:200]

    def _backoff(self, attempt: int, status: Any, code: Any) -> None:
        delay = BASE_DELAY_SECONDS * (2 ** attempt)
        label = status if status is not None else "network error"
        print(f"    Attempt {attempt + 1} failed ({label}: {code}); retrying in {delay:.0f}s")
        time.sleep(delay)

    def request(
        self,
        method: str,
        url: str,
        *,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        parse: bool = True,
    ) -> Any:
        """Send a request, retrying transient failures. Raises ApiError on
        non-retryable failures or exhausted retries."""
        for attempt in range(MAX_RETRIES + 1):
            bearer = token if token is not None else self.api_key
            try:
                response = requests.request(
                    method, url,
                    headers={"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"},
                    json=json, params=params, timeout=30,
                )
            except requests.exceptions.RequestException as e:
                if attempt < MAX_RETRIES:
                    self._backoff(attempt, None, "connection")
                    continue
                raise ApiError(None, "network_error", str(e))

            if response.status_code in RETRYABLE_STATUSES and attempt < MAX_RETRIES:
                code, _ = self._parse_error(response)
                self._backoff(attempt, response.status_code, code)
                continue

            if not response.ok:
                code, message = self._parse_error(response)
                raise ApiError(response.status_code, code, message)

            return response.json() if parse else response

        raise ApiError(None, "retries_exhausted", "Exhausted retries")

    def call_with_retry(self, operation: Callable[[], Any], label: str = "operation") -> Any:
        """Run an operation, retrying it on retryable ApiError with backoff.

        Used for multipart uploads (which the generic request() doesn't cover)
        and to demonstrate the retry policy on any unit of work."""
        for attempt in range(MAX_RETRIES + 1):
            try:
                return operation()
            except ApiError as e:
                if e.is_retryable() and attempt < MAX_RETRIES:
                    self._backoff(attempt, e.status, e.code)
                    continue
                raise
        raise ApiError(None, "retries_exhausted", f"Exhausted retries for {label}")

    def upload_file(self, file_path: Path, producer_id: str) -> str:
        """Upload a single file, retrying transient failures (5xx or network
        blips). Returns the item ID."""
        file_bytes = file_path.read_bytes()

        def operation() -> Dict[str, Any]:
            response = requests.post(
                UPLOAD_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                params={"producer_id": producer_id},
                files={"files": (file_path.name, file_bytes)},
                data={"publisher_id": PUBLISHER_ID},
                timeout=120,
            )
            if not response.ok:
                code, message = self._parse_error(response)
                raise ApiError(response.status_code, code, message)
            return response.json()

        result = self.call_with_retry(operation, "upload")
        return (result.get("ingesting") or result.get("duplicates"))[0]

    def get_item(self, item_id: str) -> Dict[str, Any]:
        return self.request("GET", f"{ITEMS_URL}/{item_id}")

    def delete_items(self, item_ids: List[str]) -> Dict[str, Any]:
        return self.request("DELETE", ITEMS_URL, json={"item_ids": item_ids})

    def wait_until_indexed(self, item_ids: List[str]) -> None:
        deadline = time.time() + POLL_TIMEOUT_SECONDS
        pending = set(item_ids)
        while pending and time.time() < deadline:
            for item_id in list(pending):
                status = self.get_item(item_id).get("status", "unknown").upper()
                if status == "COMPLETED":
                    pending.discard(item_id)
                elif status in ("FAILED", "ERROR"):
                    raise ApiError(None, "ingestion_failed", f"{item_id}: {status}")
            if pending:
                print(f"  Waiting for {len(pending)} item(s) to finish indexing...")
                time.sleep(POLL_INTERVAL_SECONDS)
        if pending:
            raise ApiError(None, "ingestion_timeout", f"Not indexed within {POLL_TIMEOUT_SECONDS}s")


def demo_error_handling(client: ResilientClient) -> None:
    """Trigger representative error responses and show the parsed result."""
    cases = [
        ("Missing item (random UUID)", "GET", f"{ITEMS_URL}/{uuid.uuid4()}", {}),
        ("Malformed item ID", "GET", f"{ITEMS_URL}/not-a-valid-uuid", {}),
        ("Rejected bearer token", "GET", f"{ITEMS_URL}/{uuid.uuid4()}",
         {"token": "invalid-token"}),
    ]
    for label, method, url, kwargs in cases:
        try:
            client.request(method, url, **kwargs)
            print(f"  {label}: unexpectedly succeeded")
        except ApiError as e:
            print(f"  {label}: status={e.status} code={e.code!r} message={e.message!r}")


def demo_retry(client: ResilientClient) -> None:
    """Show the backoff policy recovering from transient failures.

    Simulates a service returning 503 twice before succeeding — the same path a
    real 5xx or network error would take."""
    state = {"calls": 0}

    def flaky() -> Dict[str, Any]:
        state["calls"] += 1
        if state["calls"] < 3:
            raise ApiError(503, "service_unavailable", "Service temporarily unavailable")
        return {"ok": True}

    client.call_with_retry(flaky, "sample operation")
    print(f"  Succeeded after {state['calls']} attempts")


def demo_health_check(client: ResilientClient) -> None:
    """Upload a batch, confirm each item indexed, and report a health summary
    that also surfaces a missing item."""
    print("  Uploading and indexing a batch...")
    item_ids = []
    for filename, producer_id in SEED_ITEMS:
        item_ids.append(client.upload_file(SAMPLE_DIR / filename, producer_id))
    client.wait_until_indexed(item_ids)

    # Include an ID that doesn't exist to show graceful handling of 404s.
    to_check = item_ids + [str(uuid.uuid4())]
    summary = {"completed": 0, "pending": 0, "failed": 0, "not_found": 0}
    for item_id in to_check:
        try:
            status = client.get_item(item_id).get("status", "unknown").upper()
            if status == "COMPLETED":
                summary["completed"] += 1
            elif status in ("FAILED", "ERROR"):
                summary["failed"] += 1
            else:
                summary["pending"] += 1
        except ApiError as e:
            if e.status == 404:
                summary["not_found"] += 1
            else:
                raise

    print(f"  Health: {summary['completed']} completed, {summary['pending']} pending, "
          f"{summary['failed']} failed, {summary['not_found']} not found")

    # Clean up the items this recipe created.
    client.delete_items(item_ids)
    print(f"  Cleaned up {len(item_ids)} item(s)")


def main() -> None:
    client = ResilientClient(API_KEY)

    print("Step 1: Resilient client ready (error parsing, retry/backoff).")

    print("\nStep 2: Interpreting API error responses...")
    demo_error_handling(client)

    print("\nStep 3: Retrying transient failures with backoff...")
    demo_retry(client)

    print("\nStep 4: Verifying ingestion health...")
    demo_health_check(client)

    print("\nDone. The resilient client handled errors, retries, and verification end to end.")


if __name__ == "__main__":
    try:
        main()
    except ApiError as e:
        print(f"API error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
