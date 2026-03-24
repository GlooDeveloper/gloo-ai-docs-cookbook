<?php

declare(strict_types=1);

/**
 * Streaming AI Responses in Real Time - PHP Entry Point
 *
 * Demonstrates SSE-based streaming from the Gloo AI completions API.
 * Shows token accumulation and typing-effect rendering.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use GlooStreaming\Auth\TokenManager;
use GlooStreaming\Streaming\StreamClient;
use GlooStreaming\Browser\Renderer;

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

echo "Streaming AI Responses in Real Time\n\n";

$clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
$clientSecret = $_ENV['GLOO_CLIENT_SECRET'] ?? getenv('GLOO_CLIENT_SECRET');

if (!$clientId || !$clientSecret) {
    echo "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET\n";
    exit(1);
}

echo "Environment variables loaded\n\n";

// --- Example 1: Accumulate full response ---
echo "Example: Streaming a completion (accumulate full text)...\n";
$token = TokenManager::ensureValidToken();
$result = StreamClient::streamCompletion(
    'What is the significance of the resurrection?',
    $token
);
echo "\nFull response:\n" . $result['text'] . "\n";
echo "\nReceived {$result['token_count']} tokens in {$result['duration_ms']}ms\n";
echo "  Finish reason: {$result['finish_reason']}\n";

// --- Example 2: Typing-effect rendering ---
echo "\nExample: Typing-effect rendering...\n";
Renderer::renderStreamToTerminal('Tell me about Christian discipleship.', $token);
