# RAG Pipeline Part 3: Verification, Error Handling & Resilience (PHP)

Part 3 of the Build an End-to-End RAG Pipeline series. Builds a small resilient
API client and demonstrates three production concerns against the Gloo AI Data
Engine: interpreting structured API errors, retrying transient failures with
exponential backoff, and verifying ingestion health while handling missing
items gracefully.

## Prerequisites

- PHP 8.1+ with the curl extension, Composer
- A Gloo AI publisher (create one in [Gloo Studio](https://studio.ai.gloo.com))
- API credentials from Studio > Settings > API Keys

## Setup

```bash
composer install
cp .env.example .env
# Edit .env with your credentials and publisher ID
```

## Run

```bash
php index.php
```

The program:
1. Builds a resilient client (token refresh on 401, structured error parsing,
   retry with exponential backoff for transient failures)
2. Interprets API error responses — triggers a 404, a 400, and a 403 and shows
   the parsed status, code, and message
3. Retries a transient failure with backoff (simulated 503 → recovers)
4. Verifies ingestion health — uploads a batch, polls to `COMPLETED`, reports a
   health summary that surfaces a missing item, then cleans up

## Notes

- **Retry policy:** only transient failures (500/502/503/504 and network errors)
  are retried; client errors (400/401/403/404/422) fail fast.
- **No monitoring endpoints:** the Data Engine has no health/status service, so
  verification is built from the item APIs plus disciplined error handling.
- The retry step uses a **simulated** transient failure, since a healthy API
  can't be made to return 5xx on demand.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GLOO_CLIENT_ID` | OAuth2 client ID from Gloo Studio |
| `GLOO_CLIENT_SECRET` | OAuth2 client secret from Gloo Studio |
| `GLOO_PUBLISHER_ID` | UUID of your publisher (Studio > Data Engine > Publishers) |
