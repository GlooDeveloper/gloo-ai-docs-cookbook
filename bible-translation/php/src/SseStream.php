<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

use RuntimeException;

/**
 * Parses Gloo AI Guarded Responses SSE streams into text deltas.
 *
 * Each event arrives as an `event:` line followed by a `data:` line. Text
 * comes from `response.output_text.delta`; other `response.*` events are
 * lifecycle events and are ignored. Any other event (such as `error`) ends the
 * stream with an error, as does malformed JSON.
 */
class SseStream
{
    private ?string $event = null;
    private bool $done = false;

    /**
     * Parse a single SSE line and return its text delta, if any.
     *
     * Returns null for empty lines, `event:` lines, and lifecycle events.
     * Throws RuntimeException for malformed JSON or a non-`response.*` event.
     */
    public function parseLine(string $line): ?string
    {
        if ($this->done || $line === '') {
            return null;
        }
        if (str_starts_with($line, 'event:')) {
            $this->event = trim(substr($line, strlen('event:')));
            return null;
        }
        if (!str_starts_with($line, 'data:')) {
            return null;
        }

        $payload = trim(substr($line, strlen('data:')));
        $data = json_decode($payload, true);
        if (!is_array($data)) {
            throw new RuntimeException('Received malformed JSON in an SSE data event');
        }

        $event = $this->event;
        $this->event = null;
        if ($event === 'response.output_text.delta') {
            $delta = $data['delta'] ?? null;
            return is_string($delta) && $delta !== '' ? $delta : null;
        }
        if ($event === 'response.completed') {
            $this->done = true;
            return null;
        }
        if ($event === null || !str_starts_with($event, 'response.')) {
            throw new RuntimeException("Stream terminated by event '{$event}': {$payload}");
        }
        return null;
    }

    /** True once `response.completed` has been seen. */
    public function isDone(): bool
    {
        return $this->done;
    }

    /**
     * @return \Generator<string>
     */
    public static function parseStream(iterable $sseLines): \Generator
    {
        $parser = new self();
        foreach ($sseLines as $line) {
            $delta = $parser->parseLine((string) $line);
            if ($delta !== null) {
                yield $delta;
            }
            if ($parser->isDone()) {
                break;
            }
        }
    }
}
