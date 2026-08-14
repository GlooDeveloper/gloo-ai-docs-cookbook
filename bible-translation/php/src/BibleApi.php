<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

use RuntimeException;

class BibleApi
{
    public const URL_TEMPLATE = 'https://bible.helloao.org/api/{translation}/{book}/{chapter}.json';

    public static function buildUrl(string $bookId, int $chapter, string $translation): string
    {
        return str_replace(
            ['{translation}', '{book}', '{chapter}'],
            [$translation, $bookId, (string) $chapter],
            self::URL_TEMPLATE
        );
    }

    public static function fetchVerseText(string $reference, string $translation = 'BSB'): string
    {
        [$bookId, $chapter, $verses] = ReferenceParser::parseReference($reference);

        $url = self::buildUrl($bookId, $chapter, $translation);

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Failed to initialize curl for Bible API');
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new RuntimeException("Bible API request failed: {$error}");
        }
        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException("Bible API returned HTTP {$httpCode}");
        }

        $data = json_decode($body, true);
        if (!is_array($data)) {
            throw new RuntimeException('Bible API returned invalid JSON');
        }

        $chapterContent = $data['chapter']['content'] ?? [];
        if (!is_array($chapterContent)) {
            throw new RuntimeException('Bible API response missing chapter content');
        }

        $verseMap = [];
        foreach ($chapterContent as $item) {
            if (
                is_array($item)
                && ($item['type'] ?? null) === 'verse'
                && isset($item['number'])
            ) {
                $verseMap[(int) $item['number']] = self::extractText($item['content'] ?? []);
            }
        }

        if (empty($verses)) {
            $verses = array_keys($verseMap);
            sort($verses);
        }

        $missing = [];
        foreach ($verses as $v) {
            if (!isset($verseMap[$v])) {
                $missing[] = $v;
            }
        }
        if (!empty($missing)) {
            throw new RuntimeException('Verse(s) not found in ' . $reference . ': ' . implode(', ', $missing));
        }

        $selected = [];
        foreach ($verses as $v) {
            $selected[] = $verseMap[$v];
        }
        $selectedText = implode(' ', $selected);

        return "{$selectedText} ({$reference}, {$translation})";
    }

    /**
     * Recursively collect text fragments from verse content.
     *
     * @param mixed $content
     */
    private static function extractText($content): string
    {
        $texts = [];
        if (is_string($content)) {
            return $content;
        }
        if (is_array($content)) {
            foreach ($content as $fragment) {
                if (is_string($fragment)) {
                    $texts[] = $fragment;
                } elseif (is_array($fragment) && isset($fragment['text']) && is_string($fragment['text'])) {
                    $texts[] = $fragment['text'];
                } elseif (is_array($fragment)) {
                    $texts[] = self::extractText($fragment);
                }
            }
        }
        return trim(implode(' ', array_filter($texts, fn ($t) => is_string($t) && $t !== '')));
    }
}
