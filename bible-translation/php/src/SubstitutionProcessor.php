<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

/**
 * Stateful streaming processor for incremental SSE chunks from a curl callback.
 */
class SubstitutionProcessor
{
    private string $buffer = '';
    private string $translation;

    /** @var callable(string, string): string */
    private $fetchBibleVerse;

    /** @var callable(string): void */
    private $write;

    /** @var callable(string, \Throwable): void|null */
    private $onError;

    private SseStream $sse;

    // True after a substituted verse that already ends a sentence, until we see
    // the next character and know whether it is a redundant period.
    private bool $dropPeriod = false;

    public function __construct(
        string $translation,
        callable $fetchBibleVerse,
        callable $write,
        ?callable $onError = null
    ) {
        $this->translation = $translation;
        $this->fetchBibleVerse = $fetchBibleVerse;
        $this->write = $write;
        $this->onError = $onError;
        $this->sse = new SseStream();
    }

    public function processSseLine(string $line): void
    {
        $delta = $this->sse->parseLine($line);
        if ($delta === null) {
            return;
        }

        $this->buffer = SubstitutionStream::skipRedundantPeriod($this->buffer . $delta, $this->dropPeriod);
        $this->buffer = SubstitutionStream::processCompletePlaceholders(
            $this->buffer,
            $this->fetchBibleVerse,
            $this->write,
            $this->onError,
            $this->translation,
            $this->dropPeriod
        );

        $prefixIdx = SubstitutionStream::findIncompletePrefix($this->buffer);
        if ($prefixIdx !== null) {
            ($this->write)(substr($this->buffer, 0, $prefixIdx));
            $this->buffer = substr($this->buffer, $prefixIdx);
        } else {
            ($this->write)($this->buffer);
            $this->buffer = '';
        }
    }

    public function flush(): void
    {
        ($this->write)($this->buffer);
        $this->buffer = '';
    }
}
