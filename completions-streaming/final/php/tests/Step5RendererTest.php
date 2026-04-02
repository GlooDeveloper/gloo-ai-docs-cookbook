<?php

declare(strict_types=1);

/**
 * Typing-Effect Renderer Test
 *
 * Validates that renderStreamToTerminal() streams tokens to stdout
 * and prints a summary line with token count and finish_reason.
 *
 * Usage: php tests/Step5RendererTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use GlooStreaming\Auth\TokenManager;
use GlooStreaming\Browser\Renderer;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep5(): void
{
    echo "🧪 Testing: Typing-Effect Renderer\n\n";

    $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    if (!$clientId) {
        echo "❌ Missing GLOO_CLIENT_ID — run Step 1 first\n";
        exit(1);
    }

    try {
        $token = TokenManager::ensureValidToken();
        echo "✓ Token obtained\n\n";

        echo "Test 1: renderStreamToTerminal — streaming to terminal...\n";

        // Capture output — use a callback buffer so ob_flush() inside the renderer
        // still goes to our $captured variable rather than bypassing ob_get_clean().
        $captured = '';
        ob_start(function (string $buffer) use (&$captured): string {
            $captured .= $buffer;
            return $buffer; // also pass through to terminal
        });
        Renderer::renderStreamToTerminal('Reply with exactly: Hello streaming world', $token);
        ob_end_flush(); // flush remaining buffer through callback
        $output = $captured;

        // Verify prompt header
        if (strpos($output, 'Prompt:') === false) {
            throw new RuntimeException("Output missing 'Prompt:' header");
        }
        echo "✓ Prompt header printed\n";

        // Verify response label
        if (strpos($output, 'Response:') === false) {
            throw new RuntimeException("Output missing 'Response:' label");
        }
        echo "✓ Response label printed\n";

        // Verify token summary
        if (!preg_match('/\[(\d+) tokens, finish_reason=(\w+)\]/', $output, $m)) {
            throw new RuntimeException("Output missing token summary '[N tokens, finish_reason=X]'");
        }

        $tokenCount   = (int)$m[1];
        $finishReason = $m[2];

        if ($tokenCount === 0) {
            throw new RuntimeException('token count is 0 — no tokens were streamed');
        }

        echo "✓ Token summary found: {$tokenCount} tokens, finish_reason={$finishReason}\n";

        echo "\n✅ Typing-effect renderer working.\n";
        echo "   Next: Server-Side Proxy\n\n";

    } catch (Throwable $e) {
        echo "\n❌ Typing-Effect Renderer Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - renderStreamToTerminal should echo each token directly\n";
        echo "   - Print '[N tokens, finish_reason=X]' summary at end\n";
        echo "   - Use ob_flush()/flush() to push tokens immediately\n\n";
        exit(1);
    }
}

testStep5();
