# RAG Pipeline Part 1: Set Up the Pipeline (Go)

Uploads sample content to your Gloo AI publisher, enriches it with metadata,
and polls the Data Engine until the item is fully indexed and ready for
search and grounded completions.

## Prerequisites

- Go 1.20+
- A Gloo AI publisher (create one in [Gloo Studio](https://studio.ai.gloo.com))
- API credentials from Studio > Settings > API Keys

## Setup

```bash
go mod tidy
cp .env.example .env
# Edit .env with your credentials and publisher ID
```

## Run

```bash
go run main.go
```

The program:
1. Uploads `../sample_files/building-stronger-communities.md` with a stable
   producer ID (re-runs detect the duplicate and reuse the existing item)
2. Sets title, summary, author, and tags via the item metadata API
3. Polls item status every 15 seconds until it reaches `COMPLETED`
   (typically ~6 minutes for a fresh upload; immediate on re-runs)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GLOO_CLIENT_ID` | OAuth2 client ID from Gloo Studio |
| `GLOO_CLIENT_SECRET` | OAuth2 client secret from Gloo Studio |
| `GLOO_PUBLISHER_ID` | UUID of your publisher (Studio > Data Engine > Publishers) |
