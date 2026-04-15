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
 * Load and cache shared config values for recommendation scripts and server.
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
        'CLIENT_ID'                => $_ENV['GLOO_CLIENT_ID']     ?? 'YOUR_CLIENT_ID',
        'CLIENT_SECRET'            => $_ENV['GLOO_CLIENT_SECRET']  ?? 'YOUR_CLIENT_SECRET',
        'TENANT'                   => $_ENV['GLOO_TENANT']         ?? 'your-tenant-name',
        'COLLECTION'               => $_ENV['GLOO_COLLECTION']     ?? 'GlooProd',
        'TOKEN_URL'                => 'https://platform.ai.gloo.com/oauth2/token',
        'RECOMMENDATIONS_BASE_URL' => 'https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base',
        'RECOMMENDATIONS_VERBOSE_URL' => 'https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose',
        'AFFILIATES_URL'           => 'https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items',
        'PORT'                     => parseEnvInt($_ENV['PORT'] ?? null, 3000),
        'DEFAULT_ITEM_COUNT'       => parseEnvInt($_ENV['DEFAULT_ITEM_COUNT'] ?? null, 5),
    ];

    return $config;
}

function parseItemCount(mixed $value, int $default = 5): int
{
    if (!is_numeric($value)) {
        return $default;
    }
    return max(1, min((int) $value, 50));
}
