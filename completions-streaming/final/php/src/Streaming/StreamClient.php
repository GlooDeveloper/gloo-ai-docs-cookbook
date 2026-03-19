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
        if ($statusCode === 401) {
            throw new \RuntimeException('Authentication failed (401): Invalid or expired token');
        } elseif ($statusCode === 403) {
            throw new \RuntimeException('Authorization failed (403): Insufficient permissions');
        } elseif ($statusCode === 429) {
            throw new \RuntimeException('Rate limit exceeded (429): Too many requests');
        } elseif ($statusCode !== 200) {
            $preview = substr($responseBody, 0, 200);
            throw new \RuntimeException("API error ({$statusCode}): {$preview}");
        }
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
        $payload = json_encode([
            'messages' => [['role' => 'user', 'content' => $message]],
            'auto_routing' => true,
            'stream' => true,
        ]);

        $headers = [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ];

        $statusCode = 0;
        $headerBuffer = '';

        $ch = curl_init(self::API_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$statusCode, &$headerBuffer) {
                $headerBuffer .= $header;
                if (preg_match('/HTTP\/\d+\.?\d*\s+(\d+)/', $header, $m)) {
                    $statusCode = (int)$m[1];
                }
                return strlen($header);
            },
            CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$statusCode, $writeCallback) {
                // On the first data chunk, validate status
                if ($statusCode && $statusCode !== 200) {
                    self::handleStreamError($statusCode, $data);
                }
                $writeCallback($data);
                return strlen($data);
            },
        ]);

        $error = '';
        $result = curl_exec($ch);
        if ($result === false) {
            $error = curl_error($ch);
        }
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException("Streaming request failed: {$error}");
        }
    }

    /**
     * Parse one SSE text line from the stream.
     *
     * @param string $line Raw text line
     * @return mixed null for blank/non-data lines, '[DONE]' string, or array (parsed JSON)
     */
    public static function parseSseLine(string $line): mixed
    {
        if (!$line || !trim($line)) {
            return null;
        }
        if (!str_starts_with($line, 'data: ')) {
            return null;
        }
        $data = substr($line, 6); // strip 'data: '
        if (trim($data) === '[DONE]') {
            return '[DONE]';
        }
        $decoded = json_decode($data, true);
        if ($decoded === null) {
            return null;
        }
        return $decoded;
    }

    /**
     * Safely extract the text content from a parsed SSE chunk.
     *
     * @param array $chunk Parsed JSON array from parseSseLine
     * @return string The token text, or '' if none present
     */
    public static function extractTokenContent(array $chunk): string
    {
        try {
            $choices = $chunk['choices'] ?? [];
            if (empty($choices)) {
                return '';
            }
            $content = $choices[0]['delta']['content'] ?? '';
            return $content ?: '';
        } catch (\Throwable) {
            return '';
        }
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
        $startTime = microtime(true);

        $fullText = '';
        $tokenCount = 0;
        $finishReason = 'unknown';
        $lineBuffer = '';
        $done = false;

        $writeCallback = function (string $data) use (
            &$fullText, &$tokenCount, &$finishReason, &$lineBuffer, &$done
        ): void {
            if ($done) return;

            $lineBuffer .= $data;
            $lines = explode("\n", $lineBuffer);
            // Keep incomplete last line in buffer
            $lineBuffer = array_pop($lines);

            foreach ($lines as $line) {
                $chunk = self::parseSseLine($line);
                if ($chunk === null) continue;
                if ($chunk === '[DONE]') {
                    $done = true;
                    break;
                }
                $content = self::extractTokenContent($chunk);
                if ($content !== '') {
                    $fullText .= $content;
                    $tokenCount++;
                }
                $choices = $chunk['choices'] ?? [];
                if (!empty($choices) && !empty($choices[0]['finish_reason'])) {
                    $finishReason = $choices[0]['finish_reason'];
                }
            }
        };

        self::makeStreamingRequest($message, $token, $writeCallback);

        $durationMs = (int)(( microtime(true) - $startTime) * 1000);

        return [
            'text' => $fullText,
            'token_count' => $tokenCount,
            'duration_ms' => $durationMs,
            'finish_reason' => $finishReason,
        ];
    }
}
