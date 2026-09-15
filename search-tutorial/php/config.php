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
        'API_KEY' => $_ENV['GLOO_API_KEY'] ?? '',
        'TENANT' => $_ENV['GLOO_TENANT'] ?? 'your-tenant-name',
        'SEARCH_URL' => 'https://platform.ai.gloo.com/ai/data/v1/search',
        'COMPLETIONS_URL' => 'https://platform.ai.gloo.com/ai/v2/guarded/chat/completions',
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

function validateApiKey(string $apiKey): void
{
    if (empty($apiKey)) {
        fwrite(STDERR, "Error: GLOO_API_KEY must be set\n");
        echo "Create a .env file with your API key:\n";
        echo "GLOO_API_KEY=your_api_key_here\n";
        echo "GLOO_TENANT=your_tenant_name_here\n";
        exit(1);
    }
}
