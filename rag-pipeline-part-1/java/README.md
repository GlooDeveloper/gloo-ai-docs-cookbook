# RAG Pipeline Part 1: Set Up the Pipeline (Java)

Uploads sample content to your Gloo AI publisher, enriches it with metadata,
and polls the Data Engine until the item is fully indexed and ready for
search and grounded completions.

## Prerequisites

- Java 17+, Maven
- A Gloo AI publisher (create one in [Gloo Studio](https://studio.ai.gloo.com))
- An API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys)

## Setup

```bash
mvn compile
cp .env.example .env
# Edit .env with your credentials and publisher ID
```

## Run

```bash
mvn exec:java
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
| `GLOO_API_KEY` | API key from Gloo Studio |
| `GLOO_PUBLISHER_ID` | UUID of your publisher (Studio > Data Engine > Publishers) |
