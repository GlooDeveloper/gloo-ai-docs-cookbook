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
        // 1. Check if status code is 401 and throw an authentication error
        // 2. Check if status code is 403 and throw an authorization error
        // 3. Check if status code is 429 and throw a rate limit error
        // 4. Check if status code is not 200, throw a generic API error that includes the response body
        // 5. Return without throwing for status code 200 — that is a successful response
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
        // 1. Build Authorization and Content-Type headers using the provided token
        // 2. Build the request payload with the user message, auto_routing flag, and stream set to true
        // 3. Set up a cURL handle targeting the API URL with the payload and headers
        // 4. Set a header callback to capture the HTTP status code from the response headers
        // 5. Set a write callback that checks the status on the first chunk, then forwards each chunk to $writeCallback
        // 6. Execute and close the cURL handle
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
        // 1. Return null if the line is blank or does not start with 'data: '
        // 2. Extract the data payload by stripping the 'data: ' prefix
        // 3. Return '[DONE]' if the stripped data equals '[DONE]'
        // 4. Try to parse the data as JSON and return the result
        // 5. Return null on parse failure
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
        // 1. Get the choices array from the chunk, return empty string if absent or empty
        // 2. Get the delta array from the first choice
        // 3. Return the content value from delta, or empty string if absent or null
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
        // 1. Record the start time and initialize accumulators for the full text, token count, and finish reason
        // 2. Define a write callback closure that receives raw data chunks from the stream
        // 3. Inside the callback, split each chunk into lines and parse each with parseSseLine
        // 4. Skip non-content lines; stop processing when the stream termination signal is received
        // 5. Extract content from each chunk, append to the full text, and update token count and finish reason
        // 6. Call makeStreamingRequest with the message, token, and callback to execute the stream
        // 7. Compute elapsed duration and return an array with text, token_count, duration_ms, and finish_reason
        throw new \RuntimeException('Not implemented - see TODO comments');
    }
}
