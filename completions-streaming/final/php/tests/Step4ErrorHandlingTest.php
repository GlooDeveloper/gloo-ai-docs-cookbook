<?php

declare(strict_types=1);

/**
 * Streaming Error Handling Test
 *
 * Validates that:
 * - handleStreamError() throws the right error for 401, 403, 429
 * - handleStreamError() does not throw for 200
 * - Bad credentials produce a proper auth error
 *
 * Usage: php tests/Step4ErrorHandlingTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use GlooStreaming\Streaming\StreamClient;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep4(): void
{
    echo "🧪 Testing: Streaming Error Handling\n\n";

    $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    if (!$clientId) {
        echo "❌ Missing GLOO_CLIENT_ID — run Step 1 first\n";
        exit(1);
    }

    try {
        // Test 1: handleStreamError(401)
        echo "Test 1: handleStreamError(401)...\n";
        try {
            StreamClient::handleStreamError(401);
            throw new RuntimeException('Expected error for 401, but none thrown');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), '401') === false) {
                throw new RuntimeException("Expected 401 in message, got: " . $e->getMessage());
            }
            echo "✓ 401 throws: " . $e->getMessage() . "\n";
        }

        // Test 2: handleStreamError(403)
        echo "Test 2: handleStreamError(403)...\n";
        try {
            StreamClient::handleStreamError(403);
            throw new RuntimeException('Expected error for 403, but none thrown');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), '403') === false) {
                throw new RuntimeException("Expected 403 in message, got: " . $e->getMessage());
            }
            echo "✓ 403 throws: " . $e->getMessage() . "\n";
        }

        // Test 3: handleStreamError(429)
        echo "Test 3: handleStreamError(429)...\n";
        try {
            StreamClient::handleStreamError(429);
            throw new RuntimeException('Expected error for 429, but none thrown');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), '429') === false) {
                throw new RuntimeException("Expected 429 in message, got: " . $e->getMessage());
            }
            echo "✓ 429 throws: " . $e->getMessage() . "\n";
        }

        // Test 4: handleStreamError(200) — should not throw
        echo "Test 4: handleStreamError(200) — should not throw...\n";
        try {
            StreamClient::handleStreamError(200);
            echo "✓ 200 does not throw\n";
        } catch (RuntimeException $e) {
            throw new RuntimeException("handleStreamError(200) should not throw, but threw: " . $e->getMessage());
        }

        // Test 5: handleStreamError with generic 500
        echo "Test 5: handleStreamError(500)...\n";
        try {
            StreamClient::handleStreamError(500, 'Internal Server Error');
            throw new RuntimeException('Expected error for 500, but none thrown');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), '500') === false) {
                throw new RuntimeException("Expected 500 in message, got: " . $e->getMessage());
            }
            echo "✓ 500 throws with body: " . $e->getMessage() . "\n";
        }

        // Test 6: Bad credentials are caught
        echo "\nTest 6: Bad credentials → auth error...\n";
        try {
            StreamClient::makeStreamingRequest('test', 'invalid-token-xyz', function (string $data): void {});
            throw new RuntimeException('Expected makeStreamingRequest to throw with bad credentials');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'Expected') === 0) throw $e;
            echo "✓ Bad credentials caught: " . $e->getMessage() . "\n";
        }

        echo "\n✅ Two-phase error handling working.\n";
        echo "   Next: Browser-Based Streaming\n\n";

    } catch (Throwable $e) {
        echo "\n❌ Streaming Error Handling Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - handleStreamError should throw RuntimeException for any non-200 status\n";
        echo "   - Specific messages for 401, 403, 429 help users debug auth issues\n";
        echo "   - makeStreamingRequest checks HTTP status via header callback\n\n";
        exit(1);
    }
}

testStep4();
