#!/usr/bin/env node
/**
 * Embeddings Recipe - TypeScript Implementation
 *
 * End-to-end semantic search (mini-RAG) with your own vectors, using the Gloo AI
 * Embeddings API instead of the Data Engine:
 *
 *   chunk a small corpus  ->  embed every chunk in one batched call  ->
 *   embed the query with the same model  ->  rank chunks by cosine similarity  ->
 *   take the top-k above a relevance threshold  ->  feed the labeled chunks into
 *   a Guarded Responses call for a cited answer.
 *
 * Endpoints:
 *   POST /ai/v2/direct/embeddings   -> vectors for your own vector store
 *   POST /ai/v2/guarded/responses   -> guarded generation over the retrieved context
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline/promises';

// --- Configuration -----------------------------------------------------------

const API_KEY: string = process.env.GLOO_API_KEY || '';
const API_ROOT = 'https://platform.ai.gloo.com';
const EMBEDDINGS_URL = `${API_ROOT}/ai/v2/direct/embeddings`;
const RESPONSES_URL = `${API_ROOT}/ai/v2/guarded/responses`;

// Stay on one embedding model for both the corpus and the query: vectors from
// different models are not comparable.
const EMBEDDING_MODEL = 'gloo-openai-text-embedding-3-small';
const GENERATION_MODEL = 'gloo-openai-gpt-6-luna';

// Tuning knobs for retrieval.
const TOP_K = 3;
const RELEVANCE_THRESHOLD = 0.30;

// Chunking target (Goldilocks range from the learning center).
const TARGET_CHUNK_WORDS = 150;

const CONTENT_DIR = path.resolve(__dirname, '..', 'content');

const DEFAULT_QUERY = 'How does Bezalel choose its artists?';

// Bounded exponential backoff for retryable 503s (attempt 1, 2, 3 -> 1s, 2s, 4s).
const MAX_ATTEMPTS = 3;

// Type definitions
interface Chunk {
  chunk_id: string;
  source_file: string;
  chunk_index: number;
  text: string;
}

interface ScoredChunk extends Chunk {
  score: number;
}

interface EmbeddingItem {
  index?: number;
  embedding: number[];
}

interface Usage {
  prompt_tokens?: number;
  total_tokens?: number;
}

interface EmbeddingResponse {
  data?: EmbeddingItem[];
  usage?: Usage;
}

interface ResponsesContent {
  type?: string;
  text?: string;
}

interface ResponsesItem {
  type?: string;
  content?: ResponsesContent[];
}

interface ResponsesResponse {
  output?: ResponsesItem[];
}

const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

// --- HTTP helpers ------------------------------------------------------------

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Pull a human-readable message (and param, when present) out of an error body. */
async function errorDetail(response: Response): Promise<string> {
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return raw.trim() || '(no response body)';
  }

  const record = body as Record<string, unknown>;
  const detail =
    body && typeof body === 'object' && !Array.isArray(body) && 'detail' in record
      ? record.detail
      : body;

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    let message = String(d.msg ?? d.message ?? JSON.stringify(detail));
    const param = d.param;
    if (param) {
      message = `${message} (parameter: ${param})`;
    }
    return message;
  }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (first && typeof first === 'object') {
      const f = first as Record<string, unknown>;
      let message = String(f.msg ?? f.message ?? JSON.stringify(first));
      const loc = Array.isArray(f.loc) ? f.loc[f.loc.length - 1] : undefined;
      const param = f.param ?? loc;
      if (param) {
        message = `${message} (parameter: ${param})`;
      }
      return message;
    }
  }
  return String(detail);
}

/**
 * POST with the recipe's shared error handling and 503 backoff.
 *
 * Throws an Error with a clear message. Returns the parsed JSON body.
 * When guardrail403 is set, a 403 is surfaced as a guardrails hard-block
 * (the guarded surface can refuse content) rather than an auth failure.
 */
async function post<T>(
  url: string,
  payload: unknown,
  context: string,
  guardrail403 = false
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(`${context} request failed: ${(error as Error).message}`);
    }

    const status = response.status;

    if (status === 503) {
      let retryable = false;
      try {
        retryable = Boolean((await response.clone().json() as { retryable?: boolean }).retryable);
      } catch {
        // no JSON body; treat as not retryable
      }
      if (retryable && attempt < MAX_ATTEMPTS) {
        const delay = 2 ** (attempt - 1); // 1s, 2s, 4s
        console.log(
          `  ${context}: provider unavailable (503, retryable) — ` +
            `retrying in ${delay}s (attempt ${attempt}/${MAX_ATTEMPTS})`
        );
        await sleep(delay);
        continue;
      }
      const text = (await response.text()).trim();
      throw new Error(
        `${context}: provider unavailable (503) after ${attempt} attempt(s): ${text}`
      );
    }

    if (status === 400) {
      throw new Error(
        `${context}: bad request (400) — fix the request. ${await errorDetail(response)}`
      );
    }

    if (status === 403 && guardrail403) {
      throw new Error(
        `${context}: guardrails hard-blocked this request (403). ${await errorDetail(response)}`
      );
    }

    if (status === 401 || status === 403) {
      throw new Error(
        `${context}: authentication/permission error (${status}) — ` +
          `check GLOO_API_KEY and organization access. ${await errorDetail(response)}`
      );
    }

    if (status === 402 || status === 429) {
      throw new Error(
        `${context}: spending limit or rate limit reached (${status}). ${await errorDetail(response)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `${context}: request failed with status ${status}: ${await errorDetail(response)}`
      );
    }

    return await response.json() as T;
  }

  // Unreachable: the loop either returns or throws.
  throw new Error(`${context}: request failed after ${MAX_ATTEMPTS} attempts`);
}

// --- Corpus + chunking -------------------------------------------------------

/** Split a file into paragraphs on blank-line boundaries. */
function loadParagraphs(filePath: string): string[] {
  const paragraphs: string[] = [];
  for (const block of readFileSync(filePath, 'utf-8').split('\n\n')) {
    const text = block.split(/\s+/).filter(Boolean).join(' ');
    if (text) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

/**
 * Greedily pack consecutive paragraphs into ~TARGET_CHUNK_WORDS-word chunks.
 *
 * Paragraphs are kept whole, so a dense paragraph can push a chunk over the
 * target; that is expected and visible in the output.
 */
function chunkFile(filePath: string, sourceFile: string): Chunk[] {
  const chunks: Chunk[] = [];
  let currentWords = 0;
  let currentParts: string[] = [];
  let chunkIndex = 0;

  const pushChunk = (): void => {
    chunks.push({
      chunk_id: `${sourceFile}::${chunkIndex}`,
      source_file: sourceFile,
      chunk_index: chunkIndex,
      text: currentParts.join('\n\n'),
    });
    chunkIndex += 1;
    currentParts = [];
    currentWords = 0;
  };

  for (const paragraph of loadParagraphs(filePath)) {
    const wordCount = paragraph.split(' ').length;
    if (currentParts.length && currentWords + wordCount > TARGET_CHUNK_WORDS) {
      pushChunk();
    }
    currentParts.push(paragraph);
    currentWords += wordCount;
  }

  if (currentParts.length) {
    pushChunk();
  }

  return chunks;
}

/** Chunk every .txt file in the content directory, in stable filename order. */
function buildCorpus(): { corpus: Chunk[]; perFileCounts: Array<[string, number]> } {
  const files = readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.txt'))
    .sort();
  if (!files.length) {
    throw new Error(`No .txt files found in ${CONTENT_DIR}`);
  }

  const corpus: Chunk[] = [];
  const perFileCounts: Array<[string, number]> = [];
  for (const name of files) {
    const fileChunks = chunkFile(path.join(CONTENT_DIR, name), name);
    perFileCounts.push([name, fileChunks.length]);
    corpus.push(...fileChunks);
  }
  return { corpus, perFileCounts };
}

// --- Embeddings --------------------------------------------------------------

/** One batched call: embed a list of strings with the shared model. */
async function embed(
  texts: string[],
  context: string
): Promise<{ vectors: number[][]; usage?: Usage }> {
  if (!texts.length) {
    throw new Error(`${context}: refusing to embed an empty input`);
  }
  if (texts.some((t) => !t.trim())) {
    throw new Error(`${context}: input contains an empty or whitespace string`);
  }

  const payload = {
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float',
  };
  const result = await post<EmbeddingResponse>(EMBEDDINGS_URL, payload, context);

  // The API returns one embedding per input, in order; sort by index to be safe.
  const items = (result.data || [])
    .slice()
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  if (items.length !== texts.length) {
    throw new Error(`${context}: expected ${texts.length} embeddings, got ${items.length}`);
  }
  return { vectors: items.map((item) => item.embedding), usage: result.usage };
}

// --- Retrieval ---------------------------------------------------------------

/** Dot(a, b) / (||a|| * ||b||). Explicitly normalized: vectors aren't unit length. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) {
    return 0.0;
  }
  return dot / (normA * normB);
}

function rankChunks(queryVector: number[], corpus: Chunk[], vectors: number[][]): ScoredChunk[] {
  const scored = corpus.map((chunk, i) => ({
    ...chunk,
    score: cosineSimilarity(queryVector, vectors[i]),
  }));
  return scored.sort((a, b) => b.score - a.score);
}

// --- Augmentation ------------------------------------------------------------

/** Labeled-chunks prompt: instructions, then [Source: ...] context, then the question. */
function buildPrompt(
  question: string,
  selected: ScoredChunk[]
): { instructions: string; userInput: string } {
  const contextBlocks = selected.map((chunk) => {
    const label = `[Source: ${chunk.source_file}, chunk ${chunk.chunk_index}]`;
    return `${label}\n${chunk.text}`;
  });
  const context = contextBlocks.join('\n\n');

  const instructions =
    "You are an assistant for Bezalel Ministries. Answer the user's question " +
    'using only the context below. If the context does not contain enough ' +
    'information to answer fully, say so. Cite the sources you use by their ' +
    '[Source: ...] labels.';
  const userInput = `Context:\n---\n${context}\n---\nQuestion: ${question}`;
  return { instructions, userInput };
}

// --- Generation --------------------------------------------------------------

/** Extract the assistant text from a Responses payload's output[] array. */
function extractText(result: ResponsesResponse): string {
  const parts: string[] = [];
  for (const item of result.output || []) {
    if (item.type !== 'message') {
      continue;
    }
    for (const content of item.content || []) {
      if (content.type === 'output_text') {
        parts.push(content.text || '');
      }
    }
  }
  return parts.join('\n');
}

/** One Guarded Responses call over the retrieved context. */
async function generateAnswer(
  instructions: string,
  userInput: string
): Promise<ResponsesResponse> {
  const payload = {
    model: GENERATION_MODEL,
    instructions,
    input: userInput,
    max_output_tokens: 500,
    temperature: 0.2,
    // Uncomment to request a values-aligned answer for a specific tradition —
    // a Gloo capability the direct surface can't offer:
    // tradition: 'evangelical',
  };
  // A 403 here is surfaced as a guardrails hard-block, not an auth failure:
  // the guarded surface can refuse content.
  return post<ResponsesResponse>(RESPONSES_URL, payload, 'Guarded Responses', true);
}

// --- Main --------------------------------------------------------------------

async function resolveQuery(): Promise<string> {
  const arg = process.argv[2];
  if (arg && arg.trim()) {
    return arg.trim();
  }
  if (!process.stdin.isTTY) {
    return DEFAULT_QUERY;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const entered = (await rl.question(`Query [${DEFAULT_QUERY}]: `)).trim();
  rl.close();
  return entered || DEFAULT_QUERY;
}

async function main(): Promise<void> {
  if (!API_KEY.trim() || API_KEY === 'your_gloo_api_key_here') {
    console.error(
      'Missing GLOO_API_KEY. Set it in your environment or in a .env file ' +
        '(see .env.example).'
    );
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('  EMBEDDINGS RECIPE — semantic search with your own vector store');
  console.log('='.repeat(80));

  // Step 0/1: corpus + chunking.
  const { corpus, perFileCounts } = buildCorpus();
  console.log(`\nCorpus: ${corpus.length} chunks from ${perFileCounts.length} files`);
  for (const [name, count] of perFileCounts) {
    console.log(`  ${name}: ${count} chunks`);
  }

  // Step 2: index every chunk in one batched embeddings call.
  console.log(`\nEmbedding ${corpus.length} chunks in one batched call (${EMBEDDING_MODEL})...`);
  const chunkTexts = corpus.map((chunk) => chunk.text);
  const { vectors, usage } = await embed(chunkTexts, 'Embeddings (corpus)');
  if (usage) {
    console.log(
      `  usage: prompt_tokens=${usage.prompt_tokens} total_tokens=${usage.total_tokens}`
    );
  }

  const question = await resolveQuery();
  console.log(`\nQuery: ${question}`);

  // Step 3: embed the query with the same model, then rank by cosine similarity.
  const queryResult = await embed([question], 'Embeddings (query)');
  const queryVector = queryResult.vectors[0];
  if (queryResult.usage) {
    console.log(`  query usage: prompt_tokens=${queryResult.usage.prompt_tokens}`);
  }

  const ranked = rankChunks(queryVector, corpus, vectors);

  console.log('\nAll chunks ranked by cosine similarity:');
  ranked.forEach((chunk, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)}. ${chunk.score.toFixed(4)}  ` +
        `${chunk.source_file} chunk ${chunk.chunk_index}`
    );
  });

  const top = ranked.slice(0, TOP_K);
  console.log(`\nTop ${TOP_K} chunks (threshold ${RELEVANCE_THRESHOLD}):`);
  for (const chunk of top) {
    console.log(`  ${chunk.score.toFixed(4)}  ${chunk.source_file} chunk ${chunk.chunk_index}`);
  }

  // Relevance gate: don't confidently answer from irrelevant matches.
  if (!top.length || top[0].score < RELEVANCE_THRESHOLD) {
    console.log('\nNo sufficiently relevant chunks found');
    return;
  }

  // Step 4 + 5: augment and generate.
  const { instructions, userInput } = buildPrompt(question, top);
  console.log('\nGenerating a grounded answer (Guarded Responses)...\n');
  const result = await generateAnswer(instructions, userInput);
  const answer = extractText(result);

  console.log('='.repeat(80));
  console.log('ANSWER');
  console.log('='.repeat(80));
  console.log(answer || '(no text returned)');
  console.log('\nSources used:');
  for (const chunk of top) {
    console.log(`  - ${chunk.source_file} chunk ${chunk.chunk_index}`);
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
