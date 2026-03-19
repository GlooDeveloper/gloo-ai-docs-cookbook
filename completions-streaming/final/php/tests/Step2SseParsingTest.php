<?php

declare(strict_types=1);

/**
 * Streaming Request & SSE Line Parsing Test
 *
 * Validates that:
 * - makeStreamingRequest() opens a streaming connection
 * - parseSseLine() correctly parses data lines, blank lines, and [DONE]
 *
 * Usage: php tests/Step2SseParsingTest.php
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
        $linesProcessed = 0;
        $dataChunks     = 0;
        $doneDetected   = false;
        $lineBuffer     = '';

        StreamClient::makeStreamingRequest(
            "Say exactly: 'Stream test OK'",
            $token,
            function (string $data) use (&$linesProcessed, &$dataChunks, &$doneDetected, &$lineBuffer): void {
                if ($doneDetected) return;
                $lineBuffer .= $data;
                $lines       = explode("\n", $lineBuffer);
                $lineBuffer  = array_pop($lines);
                foreach ($lines as $line) {
                    $linesProcessed++;
                    $chunk = StreamClient::parseSseLine($line);
                    if ($chunk === '[DONE]') { $doneDetected = true; break; }
                    if (is_array($chunk)) $dataChunks++;
                }
            }
        );

        echo "✓ Streaming connection opened\n";
        echo "Test 7: Iterating SSE lines and detecting [DONE]...\n";
        echo "✓ Processed {$linesProcessed} lines, {$dataChunks} data chunks\n";

        if (!$doneDetected) {
            echo "⚠️  [DONE] not detected — stream may have ended without sentinel\n";
        } else {
            echo "✓ [DONE] sentinel detected — stream terminated cleanly\n";
        }

        echo "\n✅ Streaming request and SSE parsing working.\n";
        echo "   Next: Extracting Token Content\n\n";

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
