<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

use InvalidArgumentException;

class ReferenceParser
{
    /**
     * Parse a human-readable scripture reference into USFM components.
     *
     * @return array{0: string, 1: int, 2: int[]} (book_id, chapter, verses)
     */
    public static function parseReference(string $reference): array
    {
        $normalized = BookLookup::normalizeReference($reference);

        $match = preg_match(
            '/^(\d?\s*(?:[A-Za-z]+\s+){0,3}[A-Za-z]+)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/u',
            $normalized,
            $matches
        );

        if (!$match) {
            throw new InvalidArgumentException("Could not parse reference: {$reference}");
        }

        $bookPart = trim(preg_replace('/\s+/', ' ', $matches[1]) ?? $matches[1]);
        $chapter = (int) $matches[2];
        $startVerse = ($matches[3] ?? '') !== '' ? (int) $matches[3] : null;
        $endVerse = isset($matches[4]) && $matches[4] !== '' ? (int) $matches[4] : null;

        $bookId = BookLookup::lookup($bookPart);
        if ($bookId === null) {
            throw new InvalidArgumentException("Unknown book name: {$bookPart}");
        }

        if ($startVerse === null) {
            return [$bookId, $chapter, []];
        }

        $start = $startVerse;
        $end = $endVerse ?? $start;
        if ($end < $start) {
            throw new InvalidArgumentException("Invalid verse range: {$start}-{$end}");
        }

        $verses = [];
        for ($v = $start; $v <= $end; $v++) {
            $verses[] = $v;
        }
        return [$bookId, $chapter, $verses];
    }
}
