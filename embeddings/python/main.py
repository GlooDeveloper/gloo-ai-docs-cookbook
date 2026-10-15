#!/usr/bin/env python3
"""
Embeddings Recipe - Python Implementation

End-to-end semantic search (mini-RAG) with your own vectors, using the Gloo AI
Embeddings API instead of the Data Engine:

  chunk a small corpus  ->  embed every chunk in one batched call  ->
  embed the query with the same model  ->  rank chunks by cosine similarity  ->
  take the top-k above a relevance threshold  ->  feed the labeled chunks into
  a Guarded Responses call for a cited answer.

Endpoints:
  POST /ai/v2/direct/embeddings   -> vectors for your own vector store
  POST /ai/v2/guarded/responses   -> guarded generation over the retrieved context
"""

import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Configuration -----------------------------------------------------------

API_KEY = os.getenv("GLOO_API_KEY", "")
API_ROOT = "https://platform.ai.gloo.com"
EMBEDDINGS_URL = f"{API_ROOT}/ai/v2/direct/embeddings"
RESPONSES_URL = f"{API_ROOT}/ai/v2/guarded/responses"

# Stay on one embedding model for both the corpus and the query: vectors from
# different models are not comparable.
EMBEDDING_MODEL = "gloo-openai-text-embedding-3-small"
GENERATION_MODEL = "gloo-openai-gpt-6-luna"

# Tuning knobs for retrieval.
TOP_K = 3
RELEVANCE_THRESHOLD = 0.30

# Chunking target (Goldilocks range from the learning center).
TARGET_CHUNK_WORDS = 150

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

DEFAULT_QUERY = "How does Bezalel choose its artists?"

# Bounded exponential backoff for retryable 503s (attempt 1, 2, 3 -> 1s, 2s, 4s).
MAX_ATTEMPTS = 3


# --- HTTP helpers ------------------------------------------------------------


def _headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }


def _error_detail(response):
    """Pull a human-readable message (and param, when present) out of an error body."""
    try:
        body = response.json()
    except ValueError:
        return response.text.strip() or "(no response body)"

    detail = body.get("detail", body) if isinstance(body, dict) else body
    if isinstance(detail, dict):
        message = detail.get("msg") or detail.get("message") or str(detail)
        param = detail.get("param")
        if param:
            message = f"{message} (parameter: {param})"
        return message
    if isinstance(detail, list) and detail:
        first = detail[0]
        if isinstance(first, dict):
            message = first.get("msg") or first.get("message") or str(first)
            param = first.get("param") or (first.get("loc") and first["loc"][-1])
            if param:
                message = f"{message} (parameter: {param})"
            return message
    return str(detail)


def _post(url, payload, context, guardrail_403=False):
    """POST with the recipe's shared error handling and 503 backoff.

    Raises RuntimeError with a clear message. Returns the parsed JSON body.
    When guardrail_403 is set, a 403 is surfaced as a guardrails hard-block
    (the guarded surface can refuse content) rather than an auth failure.
    """
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = requests.post(url, headers=_headers(), json=payload)
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"{context} request failed: {e}") from e

        status = response.status_code

        if status == 503:
            retryable = False
            try:
                retryable = bool(response.json().get("retryable", False))
            except ValueError:
                pass
            if retryable and attempt < MAX_ATTEMPTS:
                delay = 2 ** (attempt - 1)  # 1s, 2s, 4s
                print(
                    f"  {context}: provider unavailable (503, retryable) — "
                    f"retrying in {delay}s (attempt {attempt}/{MAX_ATTEMPTS})"
                )
                time.sleep(delay)
                continue
            raise RuntimeError(
                f"{context}: provider unavailable (503) after {attempt} attempt(s): "
                f"{response.text.strip()}"
            )

        if status == 400:
            raise RuntimeError(
                f"{context}: bad request (400) — fix the request. "
                f"{_error_detail(response)}"
            )

        if status == 403 and guardrail_403:
            raise RuntimeError(
                f"{context}: guardrails hard-blocked this request (403). "
                f"{_error_detail(response)}"
            )

        if status in (401, 403):
            raise RuntimeError(
                f"{context}: authentication/permission error ({status}) — "
                f"check GLOO_API_KEY and organization access. "
                f"{_error_detail(response)}"
            )

        if status in (402, 429):
            raise RuntimeError(
                f"{context}: spending limit or rate limit reached ({status}). "
                f"{_error_detail(response)}"
            )

        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            raise RuntimeError(
                f"{context}: request failed with status {status}: "
                f"{_error_detail(response)}"
            ) from e

        return response.json()

    # Unreachable: the loop either returns or raises.
    raise RuntimeError(f"{context}: request failed after {MAX_ATTEMPTS} attempts")


# --- Corpus + chunking -------------------------------------------------------


def load_paragraphs(path):
    """Split a file into paragraphs on blank-line boundaries."""
    paragraphs = []
    for block in path.read_text(encoding="utf-8").split("\n\n"):
        text = " ".join(block.split())
        if text:
            paragraphs.append(text)
    return paragraphs


def chunk_file(path, source_file):
    """Greedily pack consecutive paragraphs into ~TARGET_CHUNK_WORDS-word chunks.

    Paragraphs are kept whole, so a dense paragraph can push a chunk over the
    target; that is expected and visible in the output.
    """
    chunks = []
    current_words = 0
    current_parts = []
    chunk_index = 0

    for paragraph in load_paragraphs(path):
        word_count = len(paragraph.split())
        if current_parts and current_words + word_count > TARGET_CHUNK_WORDS:
            chunks.append(
                {
                    "chunk_id": f"{source_file}::{chunk_index}",
                    "source_file": source_file,
                    "chunk_index": chunk_index,
                    "text": "\n\n".join(current_parts),
                }
            )
            chunk_index += 1
            current_parts = []
            current_words = 0
        current_parts.append(paragraph)
        current_words += word_count

    if current_parts:
        chunks.append(
            {
                "chunk_id": f"{source_file}::{chunk_index}",
                "source_file": source_file,
                "chunk_index": chunk_index,
                "text": "\n\n".join(current_parts),
            }
        )

    return chunks


def build_corpus():
    """Chunk every .txt file in the content directory, in stable filename order."""
    files = sorted(CONTENT_DIR.glob("*.txt"))
    if not files:
        raise RuntimeError(f"No .txt files found in {CONTENT_DIR}")

    corpus = []
    per_file_counts = []
    for path in files:
        file_chunks = chunk_file(path, path.name)
        per_file_counts.append((path.name, len(file_chunks)))
        corpus.extend(file_chunks)
    return corpus, per_file_counts


# --- Embeddings --------------------------------------------------------------


def embed(texts, context):
    """One batched call: embed a list of strings with the shared model."""
    if not texts:
        raise RuntimeError(f"{context}: refusing to embed an empty input")
    if any(not t.strip() for t in texts):
        raise RuntimeError(f"{context}: input contains an empty or whitespace string")

    payload = {
        "model": EMBEDDING_MODEL,
        "input": texts,
        "encoding_format": "float",
    }
    result = _post(EMBEDDINGS_URL, payload, context)

    # The API returns one embedding per input, in order; sort by index to be safe.
    items = sorted(result.get("data", []), key=lambda item: item.get("index", 0))
    if len(items) != len(texts):
        raise RuntimeError(
            f"{context}: expected {len(texts)} embeddings, got {len(items)}"
        )
    return [item["embedding"] for item in items], result.get("usage")


# --- Retrieval ---------------------------------------------------------------


def cosine_similarity(a, b):
    """Dot(a, b) / (||a|| * ||b||). Explicitly normalized: vectors aren't unit length."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def rank_chunks(query_vector, corpus, vectors):
    scored = [
        {**chunk, "score": cosine_similarity(query_vector, vector)}
        for chunk, vector in zip(corpus, vectors)
    ]
    return sorted(scored, key=lambda item: item["score"], reverse=True)


# --- Augmentation ------------------------------------------------------------


def build_prompt(question, selected):
    """Labeled-chunks prompt: instructions, then [Source: ...] context, then the question."""
    context_blocks = []
    for chunk in selected:
        label = f"[Source: {chunk['source_file']}, chunk {chunk['chunk_index']}]"
        context_blocks.append(f"{label}\n{chunk['text']}")
    context = "\n\n".join(context_blocks)

    instructions = (
        "You are an assistant for Bezalel Ministries. Answer the user's question "
        "using only the context below. If the context does not contain enough "
        "information to answer fully, say so. Cite the sources you use by their "
        "[Source: ...] labels."
    )
    user_input = (
        "Context:\n---\n"
        f"{context}\n"
        "---\n"
        f"Question: {question}"
    )
    return instructions, user_input


# --- Generation --------------------------------------------------------------


def extract_text(result):
    """Extract the assistant text from a Responses payload's output[] array."""
    parts = []
    for item in result.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                parts.append(content.get("text", ""))
    return "\n".join(parts)


def generate_answer(instructions, user_input):
    """One Guarded Responses call over the retrieved context."""
    payload = {
        "model": GENERATION_MODEL,
        "instructions": instructions,
        "input": user_input,
        "max_output_tokens": 500,
        "temperature": 0.2,
        # Uncomment to request a values-aligned answer for a specific tradition —
        # a Gloo capability the direct surface can't offer:
        # "tradition": "evangelical",
    }
    # A 403 here is surfaced as a guardrails hard-block, not an auth failure:
    # the guarded surface can refuse content.
    return _post(RESPONSES_URL, payload, "Guarded Responses", guardrail_403=True)


# --- Main --------------------------------------------------------------------


def resolve_query():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    if not sys.stdin.isatty():
        return DEFAULT_QUERY
    entered = input(f"Query [{DEFAULT_QUERY}]: ").strip()
    return entered or DEFAULT_QUERY


def main():
    if not API_KEY.strip() or API_KEY == "your_gloo_api_key_here":
        raise SystemExit(
            "Missing GLOO_API_KEY. Set it in your environment or in a .env file "
            "(see .env.example)."
        )

    print("=" * 80)
    print("  EMBEDDINGS RECIPE — semantic search with your own vector store")
    print("=" * 80)

    # Step 0/1: corpus + chunking.
    corpus, per_file_counts = build_corpus()
    print(f"\nCorpus: {len(corpus)} chunks from {len(per_file_counts)} files")
    for name, count in per_file_counts:
        print(f"  {name}: {count} chunks")

    # Step 2: index every chunk in one batched embeddings call.
    print(f"\nEmbedding {len(corpus)} chunks in one batched call ({EMBEDDING_MODEL})...")
    chunk_texts = [chunk["text"] for chunk in corpus]
    vectors, usage = embed(chunk_texts, "Embeddings (corpus)")
    if usage:
        print(
            f"  usage: prompt_tokens={usage.get('prompt_tokens')} "
            f"total_tokens={usage.get('total_tokens')}"
        )

    question = resolve_query()
    print(f"\nQuery: {question}")

    # Step 3: embed the query with the same model, then rank by cosine similarity.
    query_vector, query_usage = embed([question], "Embeddings (query)")
    query_vector = query_vector[0]
    if query_usage:
        print(f"  query usage: prompt_tokens={query_usage.get('prompt_tokens')}")

    ranked = rank_chunks(query_vector, corpus, vectors)

    print("\nAll chunks ranked by cosine similarity:")
    for position, chunk in enumerate(ranked, 1):
        print(
            f"  {position:>3}. {chunk['score']:.4f}  "
            f"{chunk['source_file']} chunk {chunk['chunk_index']}"
        )

    top = ranked[:TOP_K]
    print(f"\nTop {TOP_K} chunks (threshold {RELEVANCE_THRESHOLD}):")
    for chunk in top:
        print(
            f"  {chunk['score']:.4f}  {chunk['source_file']} "
            f"chunk {chunk['chunk_index']}"
        )

    # Relevance gate: don't confidently answer from irrelevant matches.
    if not top or top[0]["score"] < RELEVANCE_THRESHOLD:
        print("\nNo sufficiently relevant chunks found")
        return

    # Step 4 + 5: augment and generate.
    instructions, user_input = build_prompt(question, top)
    print("\nGenerating a grounded answer (Guarded Responses)...\n")
    result = generate_answer(instructions, user_input)
    answer = extract_text(result)

    print("=" * 80)
    print("ANSWER")
    print("=" * 80)
    print(answer or "(no text returned)")
    print("\nSources used:")
    for chunk in top:
        print(f"  - {chunk['source_file']} chunk {chunk['chunk_index']}")


if __name__ == "__main__":
    main()
