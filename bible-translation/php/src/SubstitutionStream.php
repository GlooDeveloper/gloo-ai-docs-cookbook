<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

class SubstitutionStream
{
    public const PLACEHOLDER_START = '{{SCRIPTURE:';

    // Matches substituted text whose verse already ends a sentence, e.g.
    // "...through Him. (John 3:17, BSB)", so a period the model writes after
    // the placeholder can be dropped instead of doubling up as "...BSB).".
    public const ENDS_SENTENCE_RE = '/[.!?]["\'”’)]*\s*\([^()]*\)$/u';

    /**
     * Stream content to the writer, substituting complete {{SCRIPTURE:...}}
     * placeholders using the supplied fetcher.
     *
     * @param iterable<string> $sseLines
     * @param callable(string, string): string $fetchBibleVerse
     * @param callable(string): void $write
     * @param callable(string, \Throwable): void|null $onError
     */
    public static function streamWithSubstitution(
        iterable $sseLines,
        callable $fetchBibleVerse,
        callable $write,
        ?callable $onError = null,
        string $translation = 'BSB'
    ): void {
        $processor = new SubstitutionProcessor($translation, $fetchBibleVerse, $write, $onError);
        foreach ($sseLines as $line) {
            $processor->processSseLine((string) $line);
        }
        $processor->flush();
    }

    /**
     * Process all complete placeholders in the buffer, emitting everything before
     * and including substitutions, and return the remaining unconsumed buffer.
     *
     * @param callable(string, string): string $fetchBibleVerse
     * @param callable(string): void $write
     * @param callable(string, \Throwable): void|null $onError
     * @param bool $dropPeriod Set when a substituted verse already ends a
     *                         sentence; carried across calls by the caller.
     */
    public static function processCompletePlaceholders(
        string $buffer,
        callable $fetchBibleVerse,
        callable $write,
        ?callable $onError,
        string $translation,
        bool &$dropPeriod = false
    ): string {
        while (true) {
            $match = self::findPlaceholder($buffer);
            if ($match === null) {
                break;
            }

            $write(substr($buffer, 0, $match['start']));

            $reference = trim($match['reference']);
            try {
                $verseText = $fetchBibleVerse($reference, $translation);
                $substituted = true;
            } catch (\Throwable $exc) {
                $verseText = '{{SCRIPTURE:' . $reference . '}}';
                $substituted = false;
                if ($onError !== null) {
                    $onError($reference, $exc);
                }
            }

            $write($verseText);
            $dropPeriod = $substituted && preg_match(self::ENDS_SENTENCE_RE, $verseText) === 1;
            $buffer = self::skipRedundantPeriod(substr($buffer, $match['end']), $dropPeriod);
        }

        return $buffer;
    }

    /**
     * Drop a single leading period when the previous substituted verse already
     * ended a sentence. Clears $dropPeriod once there is text to inspect.
     */
    public static function skipRedundantPeriod(string $text, bool &$dropPeriod): string
    {
        if ($dropPeriod && $text !== '') {
            $dropPeriod = false;
            if (str_starts_with($text, '.')) {
                return substr($text, 1);
            }
        }
        return $text;
    }

    /**
     * Return the index at which a placeholder prefix begins, if any.
     */
    public static function findIncompletePrefix(string $buffer): ?int
    {
        // PHP string slicing uses byte offsets. The marker is ASCII, so use
        // byte-based searches here as well to avoid splitting UTF-8 characters.
        $markerIndex = strrpos($buffer, self::PLACEHOLDER_START);
        if ($markerIndex !== false) {
            $referenceStart = $markerIndex + strlen(self::PLACEHOLDER_START);
            if (strpos($buffer, '}}', $referenceStart) === false) {
                return $markerIndex;
            }
        }

        $maxPrefixLength = min(strlen($buffer), strlen(self::PLACEHOLDER_START) - 1);
        for ($prefixLength = $maxPrefixLength; $prefixLength > 0; $prefixLength--) {
            $prefix = substr(self::PLACEHOLDER_START, 0, $prefixLength);
            if (str_ends_with($buffer, $prefix)) {
                return strlen($buffer) - $prefixLength;
            }
        }

        return null;
    }

    /**
     * @return array{start: int, end: int, reference: string}|null
     */
    private static function findPlaceholder(string $buffer): ?array
    {
        if (preg_match('/\{\{SCRIPTURE:([^}]+)\}\}/', $buffer, $matches, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }
        return [
            'start' => (int) $matches[0][1],
            'end' => (int) $matches[0][1] + strlen($matches[0][0]),
            'reference' => (string) $matches[1][0],
        ];
    }
}
