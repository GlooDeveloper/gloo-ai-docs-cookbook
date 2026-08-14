<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

require __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Gloo AI API endpoint for chat completions.
const GLOO_API_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

// System prompt that instructs the model to use placeholders instead of quoting.
const SYSTEM_PROMPT =
    'Never quote Bible verses directly from memory. When you want to reference '
    . 'a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} '
    . '(e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system '
    . 'will replace these placeholders with the actual verse text from the '
    . 'specified Bible translation. You may still discuss, explain, and comment '
    . 'on Scripture, but the actual verse text must always come through the '
    . 'placeholder mechanism.';

function parseArgs(array $argv): array
{
    $prompt = null;
    $tradition = null;
    $translation = 'BSB';

    $skipNext = false;
    for ($i = 1; $i < count($argv); $i++) {
        if ($skipNext) {
            $skipNext = false;
            continue;
        }

        $arg = $argv[$i];
        if ($arg === '--tradition') {
            if ($i + 1 >= count($argv)) {
                throw new \InvalidArgumentException('--tradition requires a value');
            }
            $tradition = $argv[$i + 1];
            $skipNext = true;
        } elseif (str_starts_with($arg, '--tradition=')) {
            $tradition = substr($arg, strlen('--tradition='));
        } elseif ($arg === '--translation') {
            if ($i + 1 >= count($argv)) {
                throw new \InvalidArgumentException('--translation requires a value');
            }
            $translation = $argv[$i + 1];
            $skipNext = true;
        } elseif (str_starts_with($arg, '--translation=')) {
            $translation = substr($arg, strlen('--translation='));
        } elseif ($arg === '--help' || $arg === '-h') {
            fwrite(STDOUT, "Usage: php index.php \"prompt\" [--tradition VALUE] [--translation VALUE]\n");
            exit(0);
        } else {
            if ($prompt === null) {
                $prompt = $arg;
            } else {
                $prompt .= ' ' . $arg;
            }
        }
    }

    if ($prompt === null || trim($prompt) === '') {
        throw new \InvalidArgumentException('prompt is required');
    }

    return [$prompt, $tradition, $translation];
}

function buildRequestBody(string $prompt, ?string $tradition): array
{
    $body = [
        'messages' => [
            ['role' => 'system', 'content' => SYSTEM_PROMPT],
            ['role' => 'user', 'content' => $prompt],
        ],
        'auto_routing' => true,
        'stream' => true,
    ];
    if ($tradition !== null) {
        $body['tradition'] = $tradition;
    }
    return $body;
}

function main(array $argv): int
{
    $dotenv = Dotenv::createImmutable(__DIR__);
    try {
        $dotenv->load();
    } catch (\Throwable $e) {
        // .env is optional if environment variables are already set.
    }

    try {
        [$prompt, $tradition, $translation] = parseArgs($argv);
    } catch (\Throwable $e) {
        fwrite(STDERR, "Error: {$e->getMessage()}\n");
        return 1;
    }

    $apiKey = $_ENV['GLOO_API_KEY'] ?? $_SERVER['GLOO_API_KEY'] ?? getenv('GLOO_API_KEY') ?: '';
    if ($apiKey === '') {
        fwrite(STDERR, "Error: GLOO_API_KEY is not set. "
            . "Get your API key from https://studio.ai.gloo.com/api-keys "
            . "and add it to your environment or .env file.\n");
        return 1;
    }

    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ];
    $body = json_encode(buildRequestBody($prompt, $tradition), JSON_THROW_ON_ERROR);

    $processor = new SubstitutionProcessor(
        $translation,
        static fn (string $reference, string $trans) => BibleApi::fetchVerseText($reference, $trans),
        static function (string $text): void {
            echo $text;
        },
        static function (string $reference, \Throwable $exc): void {
            fwrite(STDERR, "\n[Bible API error for {$reference}: {$exc->getMessage()}]\n");
        }
    );

    $ch = curl_init(GLOO_API_URL);
    if ($ch === false) {
        fwrite(STDERR, "Error: failed to initialize curl\n");
        return 1;
    }

    $rawBuffer = '';
    $streamError = null;

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_WRITEFUNCTION => static function ($curl, $chunk) use ($processor, &$rawBuffer, &$streamError): int {
            try {
                $rawBuffer .= $chunk;
                while (($newlinePos = strpos($rawBuffer, "\n")) !== false) {
                    $line = substr($rawBuffer, 0, $newlinePos);
                    $rawBuffer = substr($rawBuffer, $newlinePos + 1);
                    $processor->processSseLine(rtrim($line, "\r"));
                }
            } catch (\Throwable $e) {
                $streamError = $e;
                return 0;
            }
            return strlen($chunk);
        },
    ]);

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($streamError !== null) {
        fwrite(STDERR, "\nError: streaming failed: {$streamError->getMessage()}\n");
        return 1;
    }

    if ($result === false) {
        fwrite(STDERR, "Error: failed to connect to Gloo AI API: " . curl_error($ch) . "\n");
        return 1;
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        fwrite(STDERR, "Error: Gloo AI API returned HTTP {$httpCode}\n");
        return 1;
    }

    // Flush any buffered SSE data without a trailing newline.
    if ($rawBuffer !== '') {
        $processor->processSseLine(rtrim($rawBuffer, "\r"));
    }
    $processor->flush();

    echo "\n";
    return 0;
}

exit(main($argv));
