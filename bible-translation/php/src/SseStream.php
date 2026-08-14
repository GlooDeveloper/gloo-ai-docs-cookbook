<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

use RuntimeException;

/**
 * Parses Gloo AI SSE streaming responses into content deltas.
 */
class SseStream
{
    /**
     * Parse a single SSE line and return its content delta, if any.
     *
     * Returns null for empty lines, non-data fields, and data: [DONE].
     * Throws RuntimeException for malformed JSON in a data event.
     */
    public static function parseLine(string $line): ?string
    {
        if ($line === '') {
            return null;
        }
        if (!str_starts_with($line, 'data: ')) {
            return null;
        }

        $payload = substr($line, strlen('data: '));
        if ($payload === '[DONE]') {
            return null;
        }

        $chunk = json_decode($payload, true);
        if (!is_array($chunk)) {
            throw new RuntimeException('Received malformed JSON in an SSE data event');
        }

        $content = $chunk['choices'][0]['delta']['content'] ?? null;
        if (is_string($content) && $content !== '') {
            return $content;
        }

        return null;
    }

    /**
     * @return \Generator<string>
     */
    public static function parseStream(iterable $sseLines): \Generator
    {
        foreach ($sseLines as $line) {
            $text = (string) $line;
            if ($text === 'data: [DONE]') {
                break;
            }
            $delta = self::parseLine($text);
            if ($delta !== null) {
                yield $delta;
            }
        }
    }
}
