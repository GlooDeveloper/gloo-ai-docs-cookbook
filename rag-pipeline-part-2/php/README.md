# RAG Pipeline Part 2: Content Lifecycle (PHP)

Part 2 of the Build an End-to-End RAG Pipeline series. Seeds a small set of
items, then runs the content lifecycle — update a single item, bulk-edit
several items, verify the changes, and delete the items (cleanup). Every
mutation is scoped to the exact item IDs this recipe created, so it never
touches other content in the publisher.

## Prerequisites

- PHP 8.1+ with the curl extension, Composer
- A Gloo AI publisher (create one in [Gloo Studio](https://studio.ai.gloo.com))
- API credentials from [Gloo AI Studio](https://studio.ai.gloo.com/)

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
1. Uploads three sample files from `../sample_files/`, each under a stable
   producer ID, **capturing the item ID each upload returns**, then waits for
   ingestion to complete (a few minutes)
2. Updates one item's title and summary (`PATCH /engine/v2/item`)
3. Bulk-edits all three — appends a tag, replaces the author
   (`PATCH /engine/v2/items`, filtered to the captured item IDs)
4. Verifies each change by re-fetching (with a short read-after-write retry)
5. Deletes the items and confirms each is gone (`DELETE /engine/v2/items`,
   then `GET` returns 404)

## Notes

- **Scoping:** bulk edits and deletes target the specific item IDs captured
  from the upload responses — never the whole publisher.
- **Eventual consistency:** edits succeed immediately but can take a few
  seconds to appear on a subsequent read, so verification re-fetches until the
  change is visible. Deletion is authoritative via `GET` returning 404.
- **`by-producer` caveat:** the `POST .../items/by-producer` lookup is cached
  (~5 min) and not invalidated on writes, so it can return stale/deleted item
  IDs right after an upload or delete. This recipe relies on the item IDs from
  the upload responses instead.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GLOO_CLIENT_ID` | OAuth2 client ID from Gloo Studio |
| `GLOO_CLIENT_SECRET` | OAuth2 client secret from Gloo Studio |
| `GLOO_PUBLISHER_ID` | UUID of your publisher (Studio > Data Engine > Publishers) |
