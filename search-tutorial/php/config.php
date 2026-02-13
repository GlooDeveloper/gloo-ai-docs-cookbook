<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

function parseEnvInt(?string $value, int $fallback): int
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        return $fallback;
    }
    return (int) $value;
}

/**
 * Load and cache shared config values for tutorial scripts/server.
 */
function loadConfig(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();

    $config = [
        'CLIENT_ID' => $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID',
        'CLIENT_SECRET' => $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET',
        'TENANT' => $_ENV['GLOO_TENANT'] ?? 'your-tenant-name',
        'TOKEN_URL' => 'https://platform.ai.gloo.com/oauth2/token',
        'SEARCH_URL' => 'https://platform.ai.gloo.com/ai/data/v1/search',
        'COMPLETIONS_URL' => 'https://platform.ai.gloo.com/ai/v2/chat/completions',
        'PORT' => parseEnvInt($_ENV['PORT'] ?? null, 3000),
        'RAG_MAX_TOKENS' => parseEnvInt($_ENV['RAG_MAX_TOKENS'] ?? null, 3000),
        'RAG_CONTEXT_MAX_SNIPPETS' => parseEnvInt($_ENV['RAG_CONTEXT_MAX_SNIPPETS'] ?? null, 5),
        'RAG_CONTEXT_MAX_CHARS_PER_SNIPPET' => parseEnvInt(
            $_ENV['RAG_CONTEXT_MAX_CHARS_PER_SNIPPET'] ?? null,
            350
        ),
    ];

    return $config;
}

function normalizeLimit($value, int $fallback = 10, int $min = 1, int $max = 100): int
{
    if (!is_numeric($value)) {
        return $fallback;
    }
    $parsed = (int) $value;
    return max($min, min($max, $parsed));
}
