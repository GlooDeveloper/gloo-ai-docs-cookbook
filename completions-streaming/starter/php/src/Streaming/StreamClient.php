<?php

declare(strict_types=1);

namespace GlooStreaming\Streaming;

/**
 * Streaming client for Gloo AI completions API.
 *
 * Implements SSE parsing, token extraction, and accumulation loop for
 * real-time streaming responses using cURL with CURLOPT_WRITEFUNCTION.
 */
class StreamClient
{
    private const API_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

    /**
     * Check HTTP status before reading stream and throw specific errors.
     *
     * @param int $statusCode HTTP status code
     * @param string $responseBody Response body for generic errors
     * @throws \RuntimeException With a descriptive message
     */
    public static function handleStreamError(int $statusCode, string $responseBody = ''): void
    {
        // TODO: Check $statusCode and throw specific exceptions (Step 6):
        // 1. $statusCode === 401: throw new \RuntimeException("Authentication failed (401): Invalid or expired token")
        // 2. $statusCode === 403: throw new \RuntimeException("Authorization failed (403): Insufficient permissions")
        // 3. $statusCode === 429: throw new \RuntimeException("Rate limit exceeded (429): Too many requests")
        // 4. $statusCode !== 200: throw new \RuntimeException("API error ($statusCode): " . substr($responseBody, 0, 200))
        // Do NOT throw for $statusCode === 200 — that is a successful response.
        throw new \RuntimeException('Not implemented - see TODO comments');
    }

    /**
     * POST to the completions API with stream=true.
     *
     * Returns a cURL handle configured for streaming. The caller must execute
     * it and handle the output via the write callback.
     *
     * @param string $message The user message to send
     * @param string $token Valid Bearer token for authorization
     * @param callable $writeCallback Called for each chunk of response data
     * @throws \RuntimeException If the server returns a non-200 status
     */
    public static function makeStreamingRequest(string $message, string $token, callable $writeCallback): void
    {
        // TODO: Make a streaming cURL request to the completions API (Step 2):
        // 1. Initialize $statusCode = 0 and $headerBuffer = ''
        // 2. Build the JSON payload: messages, auto_routing, stream: true
        // 3. Set up cURL with CURLOPT_URL, CURLOPT_POST, CURLOPT_POSTFIELDS, Authorization header
        // 4. Set CURLOPT_HEADERFUNCTION to capture the HTTP status code from response headers
        // 5. Set CURLOPT_WRITEFUNCTION callback that:
        //    a. On first data chunk: calls handleStreamError($statusCode, '') to fail fast
        //    b. Calls $writeCallback($data) to forward each chunk
        //    c. Returns strlen($data) to signal cURL to continue
        // 6. Execute with curl_exec() and curl_close()
        throw new \RuntimeException('Not implemented - see TODO comments');
    }

    /**
     * Parse one SSE text line from the stream.
     *
     * SSE lines follow the format `data: <json-payload>`. The stream ends when a chunk
     * arrives with a non-null `choices[0].finish_reason` (e.g. "stop"). A `[DONE]`
     * sentinel is handled for compatibility but is not sent by the Gloo AI API.
     *
     * @param string $line Raw text line
     * @return mixed null for blank/non-data lines, '[DONE]' if a [DONE] sentinel is
     *   encountered (not sent by Gloo AI), or array (parsed JSON)
     */
    public static function parseSseLine(string $line): mixed
    {
        // TODO: Parse one SSE text line (Step 3):
        // 1. Return null if $line is blank or does not start with 'data: '
        // 2. Strip the 'data: ' prefix (6 chars): $data = substr($line, 6)
        // 3. Return '[DONE]' if trim($data) === '[DONE]'
        // 4. Try json_decode($data, true); return null on parse failure
        throw new \RuntimeException('Not implemented - see TODO comments');
    }

    /**
     * Safely extract the text content from a parsed SSE chunk.
     *
     * @param array $chunk Parsed JSON array from parseSseLine
     * @return string The token text, or '' if none present
     */
    public static function extractTokenContent(array $chunk): string
    {
        // TODO: Extract delta content from a parsed SSE chunk (Step 4):
        // 1. Get $choices = $chunk['choices'] ?? [] — return '' if empty
        // 2. Get $delta = $choices[0]['delta'] ?? []
        // 3. Return $delta['content'] ?? ''
        throw new \RuntimeException('Not implemented - see TODO comments');
    }

    /**
     * Accumulation loop: stream a completion and collect the full result.
     *
     * @param string $message The user message to send
     * @param string $token Valid Bearer token for authorization
     * @return array{text: string, token_count: int, duration_ms: int, finish_reason: string}
     */
    public static function streamCompletion(string $message, string $token): array
    {
        // TODO: Implement the accumulation loop (Step 5):
        // 1. Record $startMs = (int)(microtime(true) * 1000)
        // 2. Initialize $fullText = '', $tokenCount = 0, $finishReason = 'unknown'
        // 3. Define a $writeCallback closure that:
        //    a. Splits incoming $data on "\n" and calls parseSseLine() on each line
        //    b. Skips null; breaks on '[DONE]'
        //    c. Calls extractTokenContent() — appends to $fullText, increments $tokenCount
        //    d. Captures $choices[0]['finish_reason'] when non-null
        // 4. Call makeStreamingRequest($message, $token, $writeCallback)
        // 5. Return ['text' => $fullText, 'token_count' => $tokenCount,
        //            'duration_ms' => (int)(microtime(true) * 1000) - $startMs, 'finish_reason' => $finishReason]
        throw new \RuntimeException('Not implemented - see TODO comments');
    }
}
