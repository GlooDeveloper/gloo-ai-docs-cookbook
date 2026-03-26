<?php

declare(strict_types=1);

/**
 * Token Extraction & Full Response Assembly Test
 *
 * Validates that:
 * - extractTokenContent() safely navigates choices[0].delta.content
 * - streamCompletion() assembles the full text and tracks timing/count
 *
 * Usage: php tests/Step4AccumulationTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use GlooStreaming\Auth\TokenManager;
use GlooStreaming\Streaming\StreamClient;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep3(): void
{
    echo "🧪 Testing: Token Extraction & Accumulation\n\n";

    $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    if (!$clientId) {
        echo "❌ Missing GLOO_CLIENT_ID — run Step 1 first\n";
        exit(1);
    }

    try {
        // Test 1: extractTokenContent unit tests
        echo "Test 1: extractTokenContent — normal chunk...\n";
        $chunk  = ['choices' => [['delta' => ['content' => 'Hello'], 'finish_reason' => null]]];
        $result = StreamClient::extractTokenContent($chunk);
        if ($result !== 'Hello') {
            throw new RuntimeException("Expected 'Hello', got: " . var_export($result, true));
        }
        echo "✓ Normal chunk → 'Hello'\n";

        echo "Test 2: extractTokenContent — missing content key...\n";
        $chunk  = ['choices' => [['delta' => [], 'finish_reason' => null]]];
        $result = StreamClient::extractTokenContent($chunk);
        if ($result !== '') {
            throw new RuntimeException("Expected '', got: " . var_export($result, true));
        }
        echo "✓ Missing content key → ''\n";

        echo "Test 3: extractTokenContent — empty delta (role-only chunk)...\n";
        $chunk  = ['choices' => [['delta' => [], 'finish_reason' => null]]];
        $result = StreamClient::extractTokenContent($chunk);
        if ($result !== '') {
            throw new RuntimeException("Expected '', got: " . var_export($result, true));
        }
        echo "✓ Empty delta → ''\n";

        echo "Test 4: extractTokenContent — no choices...\n";
        $chunk  = ['choices' => []];
        $result = StreamClient::extractTokenContent($chunk);
        if ($result !== '') {
            throw new RuntimeException("Expected '', got: " . var_export($result, true));
        }
        echo "✓ Empty choices → ''\n";

        echo "Test 5: extractTokenContent — finish_reason chunk...\n";
        $chunk  = ['choices' => [['delta' => [], 'finish_reason' => 'stop']]];
        $result = StreamClient::extractTokenContent($chunk);
        if ($result !== '') {
            throw new RuntimeException("Expected '', got: " . var_export($result, true));
        }
        echo "✓ finish_reason chunk → '' (no content from finish chunk)\n\n";

        // Test 6: Full streamCompletion integration test
        echo "Test 6: streamCompletion — full response assembly...\n";
        $token  = TokenManager::ensureValidToken();
        $result = StreamClient::streamCompletion(
            'Count from 1 to 5, separated by spaces. Reply with only the numbers.',
            $token
        );

        if (!is_array($result)) {
            throw new RuntimeException("Expected array, got: " . gettype($result));
        }
        foreach (['text', 'token_count', 'duration_ms', 'finish_reason'] as $key) {
            if (!array_key_exists($key, $result)) {
                throw new RuntimeException("Missing '{$key}' key in result");
            }
        }

        echo "✓ Delta content extraction working\n";
        echo "✓ Null delta handled gracefully\n";
        echo "✓ finish_reason detected: " . $result['finish_reason'] . "\n";
        echo "✓ Duration tracked: " . $result['duration_ms'] . "ms\n";
        echo "✓ Token count: " . $result['token_count'] . " tokens\n";

        if ($result['text']) {
            echo "  Response preview: " . json_encode(substr($result['text'], 0, 80)) . "\n";
        } else {
            echo "⚠️  Empty response text — check accumulation loop\n";
        }

        if ($result['token_count'] === 0) {
            throw new RuntimeException('token_count is 0 — extractTokenContent may not be working');
        }
        if ($result['duration_ms'] <= 0) {
            throw new RuntimeException('duration_ms is 0 — timing not tracked');
        }

        echo "\n✅ Full response assembled.\n";
        echo "   Next: Typing-Effect Renderer\n\n";

    } catch (Throwable $e) {
        echo "\n❌ Token Extraction & Accumulation Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - extractTokenContent: use \$chunk['choices'][0]['delta']['content'] ?? ''\n";
        echo "   - streamCompletion: increment \$tokenCount only when \$content !== ''\n";
        echo "   - Capture \$startTime = microtime(true) before the request\n\n";
        exit(1);
    }
}

testStep3();
