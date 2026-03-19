<?php

declare(strict_types=1);

/**
 * Environment Setup & Auth Verification Test
 *
 * Validates that credentials load correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * Usage: php tests/Step1AuthTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use GlooStreaming\Auth\TokenManager;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep1(): void
{
    echo "🧪 Testing: Environment Setup & Auth Verification\n\n";

    $clientId     = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    $clientSecret = $_ENV['GLOO_CLIENT_SECRET'] ?? getenv('GLOO_CLIENT_SECRET');

    if (!$clientId || !$clientSecret) {
        echo "❌ Missing required environment variables\n";
        echo "   Make sure .env file contains:\n";
        echo "   - GLOO_CLIENT_ID\n";
        echo "   - GLOO_CLIENT_SECRET\n";
        exit(1);
    }

    echo "✓ GLOO_CLIENT_ID loaded\n";
    echo "✓ GLOO_CLIENT_SECRET loaded\n\n";

    try {
        // Test 1: Get access token
        echo "Test 1: Obtaining access token...\n";
        $tokenData = TokenManager::getAccessToken();

        if (empty($tokenData['access_token'])) {
            throw new RuntimeException('Token response missing access_token field');
        }

        echo "✓ Access token obtained\n";
        echo "  Expires in: " . ($tokenData['expires_in'] ?? 'N/A') . " seconds\n";

        // Test 2: ensureValidToken caches correctly
        echo "\nTest 2: Token caching (ensureValidToken)...\n";
        $token1 = TokenManager::ensureValidToken();
        $token2 = TokenManager::ensureValidToken();

        if ($token1 !== $token2) {
            throw new RuntimeException('ensureValidToken returned different tokens on consecutive calls');
        }

        echo "✓ Token cached correctly — same token returned on consecutive calls\n";

        // Test 3: Verify streaming endpoint returns 200 + text/event-stream
        echo "\nTest 3: Verifying streaming endpoint...\n";

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
                'Authorization: Bearer ' . $token1,
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
        echo "   - Check that .env has valid GLOO_CLIENT_ID and GLOO_CLIENT_SECRET\n";
        echo "   - Verify credentials at https://platform.ai.gloo.com/studio/manage-api-credentials\n";
        echo "   - Ensure you have internet connectivity\n\n";
        exit(1);
    }
}

testStep1();
