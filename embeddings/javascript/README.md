# Gloo AI Embeddings Recipe - JavaScript

This recipe demonstrates end-to-end semantic search with your own vector store
using the Gloo AI **Embeddings API**
(`POST https://platform.ai.gloo.com/ai/v2/direct/embeddings`) for retrieval and
the **Guarded Responses API**
(`POST https://platform.ai.gloo.com/ai/v2/guarded/responses`) for generation.

It chunks a small Bezalel Ministries corpus, embeds every chunk in one batched
call, ranks chunks by cosine similarity against your question, and feeds the
top matches into a cited, guarded answer — all with in-memory vectors, no
external vector database.

## Prerequisites

- Node.js 18+ (uses the built-in `fetch`)
- A Gloo AI API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Setup

```bash
cd gloo-ai-docs-cookbook/embeddings/javascript
npm install
```

## Environment

Copy `.env.example` to `.env` and fill in your API key (or run the recipe
setup script, which generates `.env` from the master env file):

```bash
GLOO_API_KEY=your_api_key
```

## Run

```bash
npm start
```

The default query is `"How does Bezalel choose its artists?"`. Pass a custom
query as an argument, or let the script prompt you:

```bash
npm start -- "What educational resources does Bezalel provide?"
```

Expected output: chunk counts per file, the embeddings usage tokens, the full
ranked list of chunks by cosine similarity, the top-3 selection above the
relevance threshold, then the grounded answer with its source list. A query
with no relevant match prints `No sufficiently relevant chunks found` instead.

## Notes

- `TOP_K`, `RELEVANCE_THRESHOLD`, and `TARGET_CHUNK_WORDS` are tuning constants
  at the top of `index.js`; see the tutorial for what each one does.
- A `403` from the responses call is surfaced as a guardrails hard-block; a
  retryable `503` from embeddings is retried with bounded backoff (1s/2s/4s).
