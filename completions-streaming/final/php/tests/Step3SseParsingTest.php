<?php

declare(strict_types=1);

/**
 * Streaming Request & SSE Line Parsing Test
 *
 * Validates that:
 * - makeStreamingRequest() opens a streaming connection
 * - parseSseLine() correctly parses data lines, blank lines, and [DONE]
 *
 * Usage: php tests/Step3SseParsingTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use GlooStreaming\Auth\TokenManager;
use GlooStreaming\Streaming\StreamClient;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep2(): void
{
    echo "🧪 Testing: Streaming Request & SSE Line Parsing\n\n";

    $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    if (!$clientId) {
        echo "❌ Missing GLOO_CLIENT_ID — run Step 1 first\n";
        exit(1);
    }

    try {
        $token = TokenManager::ensureValidToken();
        echo "✓ Token obtained\n\n";

        // Test 1: parseSseLine — blank line
        echo "Test 1: parseSseLine — blank line...\n";
        $result = StreamClient::parseSseLine('');
        if ($result !== null) {
            throw new RuntimeException("Expected null for blank line, got: " . var_export($result, true));
        }
        echo "✓ Blank line → null\n";

        // Test 2: parseSseLine — non-data line
        echo "Test 2: parseSseLine — non-data line...\n";
        $result = StreamClient::parseSseLine('event: message');
        if ($result !== null) {
            throw new RuntimeException("Expected null for non-data line, got: " . var_export($result, true));
        }
        echo "✓ Non-data line → null\n";

        // Test 3: parseSseLine — [DONE] sentinel
        echo "Test 3: parseSseLine — [DONE] sentinel...\n";
        $result = StreamClient::parseSseLine('data: [DONE]');
        if ($result !== '[DONE]') {
            throw new RuntimeException("Expected '[DONE]', got: " . var_export($result, true));
        }
        echo "✓ data: [DONE] → '[DONE]'\n";

        // Test 4: parseSseLine — valid JSON data line
        echo "Test 4: parseSseLine — valid JSON data line...\n";
        $sample = 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}';
        $result = StreamClient::parseSseLine($sample);
        if (!is_array($result)) {
            throw new RuntimeException("Expected array, got: " . gettype($result));
        }
        if ($result['choices'][0]['delta']['content'] !== 'Hello') {
            throw new RuntimeException('Unexpected content value');
        }
        echo "✓ data: {json} → parsed array\n";

        // Test 5: parseSseLine — malformed JSON
        echo "Test 5: parseSseLine — malformed JSON...\n";
        $result = StreamClient::parseSseLine('data: {broken json');
        if ($result !== null) {
            throw new RuntimeException("Expected null for malformed JSON, got: " . var_export($result, true));
        }
        echo "✓ Malformed JSON → null (gracefully handled)\n\n";

        // Test 6: Live streaming connection
        echo "Test 6: makeStreamingRequest() — live connection...\n";
        $linesProcessed   = 0;
        $dataChunks       = 0;
        $streamTerminated = false;
        $finishReason     = null;
        $lineBuffer       = '';

        StreamClient::makeStreamingRequest(
            "Say exactly: 'Stream test OK'",
            $token,
            function (string $data) use (&$linesProcessed, &$dataChunks, &$streamTerminated, &$finishReason, &$lineBuffer): void {
                if ($streamTerminated) return;
                $lineBuffer .= $data;
                $lines       = explode("\n", $lineBuffer);
                $lineBuffer  = array_pop($lines);
                foreach ($lines as $line) {
                    $linesProcessed++;
                    $chunk = StreamClient::parseSseLine($line);
                    if (is_array($chunk)) {
                        $reason = $chunk['choices'][0]['finish_reason'] ?? null;
                        if ($reason !== null) {
                            $streamTerminated = true;
                            $finishReason = $reason;
                            break;
                        }
                        $dataChunks++;
                    }
                }
            }
        );

        echo "✓ Streaming connection opened (status 200)\n";
        echo "Test 7: Iterating SSE lines and detecting stream termination...\n";
        echo "✓ Processed {$linesProcessed} lines, {$dataChunks} data chunks\n";

        if (!$streamTerminated) {
            echo "⚠️  Stream ended without a finish_reason chunk\n";
        } else {
            echo "✓ Stream terminated cleanly (finish_reason={$finishReason})\n";
        }

        // Test 8: Bad credentials → pre-stream auth error
        echo "\nTest 8: Bad credentials → authentication error before reading stream...\n";
        try {
            StreamClient::makeStreamingRequest('Hello', 'invalid-token-xyz', function (string $data): void {});
            throw new RuntimeException('Expected makeStreamingRequest to throw with bad credentials');
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'Expected makeStreamingRequest') !== false) throw $e;
            $msg = strtolower($e->getMessage());
            if (
                strpos($e->getMessage(), '401') !== false
                || strpos($e->getMessage(), '403') !== false
                || strpos($msg, 'auth') !== false
                || strpos($msg, 'token') !== false
                || strpos($msg, 'permission') !== false
                || strpos($msg, 'invalid') !== false
            ) {
                echo "✓ Bad credentials caught (pre-stream): " . $e->getMessage() . "\n";
            } else {
                throw new RuntimeException("Expected auth error, got: " . $e->getMessage());
            }
        }

        echo "\n✅ Streaming request and SSE parsing working.\n";
        echo "   Next: Token Extraction & Accumulation\n\n";

    } catch (Throwable $e) {
        echo "\n❌ Streaming Request & SSE Parsing Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - Check makeStreamingRequest() sets stream=>true in the payload\n";
        echo "   - Check parseSseLine() strips 'data: ' prefix (substr at offset 6)\n";
        echo "   - Verify [DONE] check: trim(\$data) === '[DONE]'\n\n";
        exit(1);
    }
}

testStep2();
