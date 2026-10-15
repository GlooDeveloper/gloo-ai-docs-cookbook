#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Embeddings Recipe - PHP Implementation
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

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// --- Configuration -----------------------------------------------------------

$apiKey = $_ENV['GLOO_API_KEY'] ?? '';

const API_ROOT = 'https://platform.ai.gloo.com';
const EMBEDDINGS_URL = API_ROOT . '/ai/v2/direct/embeddings';
const RESPONSES_URL = API_ROOT . '/ai/v2/guarded/responses';

// Stay on one embedding model for both the corpus and the query: vectors from
// different models are not comparable.
const EMBEDDING_MODEL = 'gloo-openai-text-embedding-3-small';
const GENERATION_MODEL = 'gloo-openai-gpt-6-luna';

// Tuning knobs for retrieval.
const TOP_K = 3;
const RELEVANCE_THRESHOLD = 0.30;

// Chunking target (Goldilocks range from the learning center).
const TARGET_CHUNK_WORDS = 150;

const CONTENT_DIR = __DIR__ . '/../content';

const DEFAULT_QUERY = 'How does Bezalel choose its artists?';

// Bounded exponential backoff for retryable 503s (attempt 1, 2, 3 -> 1s, 2s, 4s).
const MAX_ATTEMPTS = 3;

// --- HTTP helpers ------------------------------------------------------------

/**
 * Pull a human-readable message (and param, when present) out of an error body.
 */
function errorDetail(array $response): string
{
    $raw = $response['body'] ?? '';
    $body = json_decode($raw, true);
    if ($body === null) {
        $trimmed = trim($raw);
        return $trimmed !== '' ? $trimmed : '(no response body)';
    }

    $detail = is_array($body) && array_key_exists('detail', $body) ? $body['detail'] : $body;
    if (is_array($detail) && !array_is_list($detail)) {
        $message = (string) ($detail['msg'] ?? $detail['message'] ?? json_encode($detail));
        $param = $detail['param'] ?? null;
        if ($param) {
            $message .= " (parameter: $param)";
        }
        return $message;
    }
    if (is_array($detail) && array_is_list($detail) && count($detail) > 0) {
        $first = $detail[0];
        if (is_array($first)) {
            $message = (string) ($first['msg'] ?? $first['message'] ?? json_encode($first));
            $loc = isset($first['loc']) && is_array($first['loc']) ? end($first['loc']) : null;
            $param = $first['param'] ?? $loc;
            if ($param) {
                $message .= " (parameter: $param)";
            }
            return $message;
        }
    }
    return is_string($detail) ? $detail : json_encode($detail);
}

/**
 * Send one POST request, returning {status, body}.
 *
 * @param array<string, mixed> $payload
 * @return array{status:int, body:string}
 * @throws Exception On transport failure.
 */
function sendRequest(string $url, array $payload, string $apiKey): array
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $apiKey",
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $body = curl_exec($ch);
    if ($body === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("request failed: $error");
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $status, 'body' => (string) $body];
}

/**
 * POST with the recipe's shared error handling and 503 backoff.
 *
 * Throws an Exception with a clear message. Returns the decoded JSON body.
 * When $guardrail403 is set, a 403 is surfaced as a guardrails hard-block
 * (the guarded surface can refuse content) rather than an auth failure.
 *
 * @param array<string, mixed> $payload
 * @return array<string, mixed>
 */
function post(string $url, array $payload, string $context, string $apiKey, bool $guardrail403 = false): array
{
    for ($attempt = 1; $attempt <= MAX_ATTEMPTS; $attempt++) {
        try {
            $response = sendRequest($url, $payload, $apiKey);
        } catch (Exception $e) {
            throw new Exception("$context {$e->getMessage()}", 0, $e);
        }

        $status = $response['status'];
        $body = $response['body'];

        if ($status === 503) {
            $decoded = json_decode($body, true);
            $retryable = is_array($decoded) ? (bool) ($decoded['retryable'] ?? false) : false;
            if ($retryable && $attempt < MAX_ATTEMPTS) {
                $delay = 2 ** ($attempt - 1); // 1s, 2s, 4s
                echo "  $context: provider unavailable (503, retryable) — "
                    . "retrying in {$delay}s (attempt $attempt/" . MAX_ATTEMPTS . ")\n";
                sleep($delay);
                continue;
            }
            throw new Exception(
                "$context: provider unavailable (503) after $attempt attempt(s): " . trim($body)
            );
        }

        if ($status === 400) {
            throw new Exception(
                "$context: bad request (400) — fix the request. " . errorDetail($response)
            );
        }

        if ($status === 403 && $guardrail403) {
            throw new Exception(
                "$context: guardrails hard-blocked this request (403). " . errorDetail($response)
            );
        }

        if ($status === 401 || $status === 403) {
            throw new Exception(
                "$context: authentication/permission error ($status) — "
                . 'check GLOO_API_KEY and organization access. ' . errorDetail($response)
            );
        }

        if ($status === 402 || $status === 429) {
            throw new Exception(
                "$context: spending limit or rate limit reached ($status). " . errorDetail($response)
            );
        }

        if ($status < 200 || $status >= 300) {
            throw new Exception(
                "$context: request failed with status $status: " . errorDetail($response)
            );
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new Exception("$context: response was not valid JSON: " . trim($body));
        }
        return $decoded;
    }

    // Unreachable: the loop either returns or throws.
    throw new Exception("$context: request failed after " . MAX_ATTEMPTS . ' attempts');
}

// --- Corpus + chunking -------------------------------------------------------

/**
 * Split a file into paragraphs on blank-line boundaries.
 *
 * @return string[]
 */
function loadParagraphs(string $filePath): array
{
    $paragraphs = [];
    $contents = file_get_contents($filePath);
    if ($contents === false) {
        throw new Exception("Unable to read $filePath");
    }
    foreach (explode("\n\n", $contents) as $block) {
        $text = trim(preg_replace('/\s+/', ' ', $block) ?? '');
        if ($text !== '') {
            $paragraphs[] = $text;
        }
    }
    return $paragraphs;
}

/**
 * Greedily pack consecutive paragraphs into ~TARGET_CHUNK_WORDS-word chunks.
 *
 * Paragraphs are kept whole, so a dense paragraph can push a chunk over the
 * target; that is expected and visible in the output.
 *
 * @return array<int, array<string, mixed>>
 */
function chunkFile(string $filePath, string $sourceFile): array
{
    $chunks = [];
    $currentWords = 0;
    $currentParts = [];
    $chunkIndex = 0;

    $pushChunk = function () use (&$chunks, &$currentParts, &$currentWords, &$chunkIndex, $sourceFile): void {
        $chunks[] = [
            'chunk_id' => "$sourceFile::$chunkIndex",
            'source_file' => $sourceFile,
            'chunk_index' => $chunkIndex,
            'text' => implode("\n\n", $currentParts),
        ];
        $chunkIndex++;
        $currentParts = [];
        $currentWords = 0;
    };

    foreach (loadParagraphs($filePath) as $paragraph) {
        $wordCount = count(explode(' ', $paragraph));
        if (!empty($currentParts) && $currentWords + $wordCount > TARGET_CHUNK_WORDS) {
            $pushChunk();
        }
        $currentParts[] = $paragraph;
        $currentWords += $wordCount;
    }

    if (!empty($currentParts)) {
        $pushChunk();
    }

    return $chunks;
}

/**
 * Chunk every .txt file in the content directory, in stable filename order.
 *
 * @return array{0: array<int, array<string, mixed>>, 1: array<int, array{0:string, 1:int}>}
 */
function buildCorpus(): array
{
    $files = glob(CONTENT_DIR . '/*.txt') ?: [];
    sort($files);
    if (empty($files)) {
        throw new Exception('No .txt files found in ' . CONTENT_DIR);
    }

    $corpus = [];
    $perFileCounts = [];
    foreach ($files as $path) {
        $name = basename($path);
        $fileChunks = chunkFile($path, $name);
        $perFileCounts[] = [$name, count($fileChunks)];
        foreach ($fileChunks as $chunk) {
            $corpus[] = $chunk;
        }
    }
    return [$corpus, $perFileCounts];
}

// --- Embeddings --------------------------------------------------------------

/**
 * One batched call: embed a list of strings with the shared model.
 *
 * @param string[] $texts
 * @return array{0: array<int, array<int, float>>, 1: array<string, mixed>|null}
 */
function embed(array $texts, string $context, string $apiKey): array
{
    if (empty($texts)) {
        throw new Exception("$context: refusing to embed an empty input");
    }
    foreach ($texts as $text) {
        if (trim($text) === '') {
            throw new Exception("$context: input contains an empty or whitespace string");
        }
    }

    $payload = [
        'model' => EMBEDDING_MODEL,
        'input' => array_values($texts),
        'encoding_format' => 'float',
    ];
    $result = post(EMBEDDINGS_URL, $payload, $context, $apiKey);

    // The API returns one embedding per input, in order; sort by index to be safe.
    $items = $result['data'] ?? [];
    usort($items, fn ($a, $b) => ($a['index'] ?? 0) <=> ($b['index'] ?? 0));
    if (count($items) !== count($texts)) {
        throw new Exception("$context: expected " . count($texts) . ' embeddings, got ' . count($items));
    }

    $vectors = array_map(fn ($item) => $item['embedding'], $items);
    return [$vectors, $result['usage'] ?? null];
}

// --- Retrieval ---------------------------------------------------------------

/**
 * Dot(a, b) / (||a|| * ||b||). Explicitly normalized: vectors aren't unit length.
 *
 * @param array<int, float> $a
 * @param array<int, float> $b
 */
function cosineSimilarity(array $a, array $b): float
{
    $dot = 0.0;
    $normA = 0.0;
    $normB = 0.0;
    $length = count($a);
    for ($i = 0; $i < $length; $i++) {
        $dot += $a[$i] * $b[$i];
        $normA += $a[$i] * $a[$i];
        $normB += $b[$i] * $b[$i];
    }
    $normA = sqrt($normA);
    $normB = sqrt($normB);
    if ($normA == 0.0 || $normB == 0.0) {
        return 0.0;
    }
    return $dot / ($normA * $normB);
}

/**
 * @param array<int, float> $queryVector
 * @param array<int, array<string, mixed>> $corpus
 * @param array<int, array<int, float>> $vectors
 * @return array<int, array<string, mixed>>
 */
function rankChunks(array $queryVector, array $corpus, array $vectors): array
{
    $scored = [];
    foreach ($corpus as $i => $chunk) {
        $chunk['score'] = cosineSimilarity($queryVector, $vectors[$i]);
        $scored[] = $chunk;
    }
    usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);
    return $scored;
}

// --- Augmentation ------------------------------------------------------------

/**
 * Labeled-chunks prompt: instructions, then [Source: ...] context, then the question.
 *
 * @param array<int, array<string, mixed>> $selected
 * @return array{0: string, 1: string}
 */
function buildPrompt(string $question, array $selected): array
{
    $contextBlocks = [];
    foreach ($selected as $chunk) {
        $label = "[Source: {$chunk['source_file']}, chunk {$chunk['chunk_index']}]";
        $contextBlocks[] = "$label\n{$chunk['text']}";
    }
    $context = implode("\n\n", $contextBlocks);

    $instructions =
        "You are an assistant for Bezalel Ministries. Answer the user's question "
        . 'using only the context below. If the context does not contain enough '
        . 'information to answer fully, say so. Cite the sources you use by their '
        . '[Source: ...] labels.';
    $userInput = "Context:\n---\n$context\n---\nQuestion: $question";
    return [$instructions, $userInput];
}

// --- Generation --------------------------------------------------------------

/**
 * Extract the assistant text from a Responses payload's output[] array.
 *
 * @param array<string, mixed> $result
 */
function extractText(array $result): string
{
    $parts = [];
    foreach ($result['output'] ?? [] as $item) {
        if (($item['type'] ?? null) !== 'message') {
            continue;
        }
        foreach ($item['content'] ?? [] as $content) {
            if (($content['type'] ?? null) === 'output_text') {
                $parts[] = $content['text'] ?? '';
            }
        }
    }
    return implode("\n", $parts);
}

/**
 * One Guarded Responses call over the retrieved context.
 *
 * @return array<string, mixed>
 */
function generateAnswer(string $instructions, string $userInput, string $apiKey): array
{
    $payload = [
        'model' => GENERATION_MODEL,
        'instructions' => $instructions,
        'input' => $userInput,
        'max_output_tokens' => 500,
        'temperature' => 0.2,
        // Uncomment to request a values-aligned answer for a specific tradition —
        // a Gloo capability the direct surface can't offer:
        // 'tradition' => 'evangelical',
    ];
    // A 403 here is surfaced as a guardrails hard-block, not an auth failure:
    // the guarded surface can refuse content.
    return post(RESPONSES_URL, $payload, 'Guarded Responses', $apiKey, true);
}

// --- Main --------------------------------------------------------------------

function resolveQuery(): string
{
    global $argv;
    if (isset($argv[1]) && trim($argv[1]) !== '') {
        return trim($argv[1]);
    }
    if (function_exists('stream_isatty') && !stream_isatty(STDIN)) {
        return DEFAULT_QUERY;
    }
    $entered = trim(readline('Query [' . DEFAULT_QUERY . ']: '));
    return $entered !== '' ? $entered : DEFAULT_QUERY;
}

function main(): void
{
    global $apiKey;

    if (trim($apiKey) === '' || $apiKey === 'your_gloo_api_key_here') {
        fwrite(STDERR, "Missing GLOO_API_KEY. Set it in your environment or in a .env file (see .env.example).\n");
        exit(1);
    }

    echo str_repeat('=', 80) . "\n";
    echo "  EMBEDDINGS RECIPE — semantic search with your own vector store\n";
    echo str_repeat('=', 80) . "\n";

    // Step 0/1: corpus + chunking.
    [$corpus, $perFileCounts] = buildCorpus();
    echo "\nCorpus: " . count($corpus) . ' chunks from ' . count($perFileCounts) . " files\n";
    foreach ($perFileCounts as [$name, $count]) {
        echo "  $name: $count chunks\n";
    }

    // Step 2: index every chunk in one batched embeddings call.
    echo "\nEmbedding " . count($corpus) . ' chunks in one batched call (' . EMBEDDING_MODEL . ")...\n";
    $chunkTexts = array_map(fn ($chunk) => $chunk['text'], $corpus);
    [$vectors, $usage] = embed($chunkTexts, 'Embeddings (corpus)', $apiKey);
    if ($usage) {
        echo "  usage: prompt_tokens={$usage['prompt_tokens']} total_tokens={$usage['total_tokens']}\n";
    }

    $question = resolveQuery();
    echo "\nQuery: $question\n";

    // Step 3: embed the query with the same model, then rank by cosine similarity.
    [$queryVectors, $queryUsage] = embed([$question], 'Embeddings (query)', $apiKey);
    $queryVector = $queryVectors[0];
    if ($queryUsage) {
        echo "  query usage: prompt_tokens={$queryUsage['prompt_tokens']}\n";
    }

    $ranked = rankChunks($queryVector, $corpus, $vectors);

    echo "\nAll chunks ranked by cosine similarity:\n";
    foreach ($ranked as $i => $chunk) {
        $position = $i + 1;
        printf("  %3d. %.4f  %s chunk %d\n", $position, $chunk['score'], $chunk['source_file'], $chunk['chunk_index']);
    }

    $top = array_slice($ranked, 0, TOP_K);
    echo "\nTop " . TOP_K . ' chunks (threshold ' . RELEVANCE_THRESHOLD . "):\n";
    foreach ($top as $chunk) {
        printf("  %.4f  %s chunk %d\n", $chunk['score'], $chunk['source_file'], $chunk['chunk_index']);
    }

    // Relevance gate: don't confidently answer from irrelevant matches.
    if (empty($top) || $top[0]['score'] < RELEVANCE_THRESHOLD) {
        echo "\nNo sufficiently relevant chunks found\n";
        return;
    }

    // Step 4 + 5: augment and generate.
    [$instructions, $userInput] = buildPrompt($question, $top);
    echo "\nGenerating a grounded answer (Guarded Responses)...\n\n";
    $result = generateAnswer($instructions, $userInput, $apiKey);
    $answer = extractText($result);

    echo str_repeat('=', 80) . "\n";
    echo "ANSWER\n";
    echo str_repeat('=', 80) . "\n";
    echo ($answer !== '' ? $answer : '(no text returned)') . "\n";
    echo "\nSources used:\n";
    foreach ($top as $chunk) {
        echo "  - {$chunk['source_file']} chunk {$chunk['chunk_index']}\n";
    }
}

if (php_sapi_name() === 'cli') {
    try {
        main();
    } catch (Exception $e) {
        fwrite(STDERR, 'Fatal error: ' . $e->getMessage() . "\n");
        exit(1);
    }
}
