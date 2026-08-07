<?php

declare(strict_types=1);

/**
 * Environment Setup & Auth Verification Test
 *
 * Validates that the API key loads correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * Usage: php tests/Step1AuthTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep1(): void
{
    echo "🧪 Testing: Environment Setup & Auth Verification\n\n";

    $apiKey = $_ENV['GLOO_API_KEY'] ?? getenv('GLOO_API_KEY');

    if (!$apiKey) {
        echo "❌ Missing required environment variable\n";
        echo "   Make sure .env file contains:\n";
        echo "   - GLOO_API_KEY\n";
        exit(1);
    }

    echo "✓ API key loaded\n\n";

    try {
        // Test 1: Verify streaming endpoint returns 200 + text/event-stream
        echo "Test 1: Verifying streaming endpoint with API key...\n";

        $apiUrl  = 'https://platform.ai.gloo.com/ai/v2/chat/completions';
        $payload = json_encode([
            'messages'     => [['role' => 'user', 'content' => 'Hi']],
            'auto_routing' => true,
            'stream'       => true,
        ]);

        $status      = 0;
        $contentType = '';
        $ch          = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$status, &$contentType) {
                if (preg_match('/HTTP\/\d+\.?\d*\s+(\d+)/', $header, $m)) {
                    $status = (int)$m[1];
                }
                if (stripos($header, 'content-type:') !== false) {
                    $contentType = trim(substr($header, strpos($header, ':') + 1));
                }
                return strlen($header);
            },
        ]);

        curl_exec($ch);
        curl_close($ch);

        if ($status !== 200) {
            throw new RuntimeException("Expected 200, got {$status}");
        }

        if (stripos($contentType, 'text/event-stream') === false) {
            throw new RuntimeException("Expected Content-Type: text/event-stream, got: {$contentType}");
        }

        echo "✓ Status: 200 OK\n";
        echo "✓ Content-Type: {$contentType}\n";

        echo "\n✅ Auth and streaming endpoint verified.\n";
        echo "   Next: Making the Streaming Request\n\n";

    } catch (Throwable $e) {
        echo "\n❌ Auth Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - Check that .env has a valid GLOO_API_KEY\n";
        echo "   - Verify credentials at https://studio.ai.gloo.com/api-keys\n";
        echo "   - Ensure you have internet connectivity\n\n";
        exit(1);
    }
}

testStep1();
