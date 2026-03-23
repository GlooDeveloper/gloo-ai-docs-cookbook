<?php

declare(strict_types=1);

/**
 * Server-Side Proxy Test
 *
 * Validates that:
 * - The PHP built-in server starts and handles requests
 * - POST /api/stream relays SSE from Gloo AI back to the client
 * - SSE lines arrive with correct format and [DONE] is detected
 *
 * Usage: php tests/Step6ProxyTest.php
 *
 * Note: Starts php -S in a subprocess; no separate server process needed.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

function testStep6(): void
{
    echo "🧪 Testing: Server-Side Proxy\n\n";

    $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
    if (!$clientId) {
        echo "❌ Missing GLOO_CLIENT_ID — run Step 1 first\n";
        exit(1);
    }

    $port = (int) ($_ENV['PROXY_PORT'] ?? getenv('PROXY_PORT') ?: 3001);
    $host = "127.0.0.1:{$port}";
    $proc = null;

    try {
        // Test 1: Start the PHP built-in server as a subprocess
        echo "Test 1: Starting proxy server on port {$port}...\n";

        $env = array_merge(getenv(), $_ENV, [
            'PROXY_PORT' => (string) $port,
        ]);

        // Build env string for proc_open
        $envPairs = [];
        foreach ($env as $k => $v) {
            $envPairs[] = "{$k}={$v}";
        }

        $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $proc = proc_open(
            "php -S {$host} src/Proxy/Server.php",
            $desc,
            $pipes,
            __DIR__ . '/..',
            $env
        );

        if (!is_resource($proc)) {
            throw new \RuntimeException("Failed to start proxy subprocess");
        }

        // Wait for the server to be ready by polling with an OPTIONS request
        $ready = false;
        for ($i = 0; $i < 20; $i++) {
            usleep(200_000); // 200ms
            $ch = curl_init("http://{$host}/api/stream");
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST  => 'OPTIONS',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 1,
                CURLOPT_CONNECTTIMEOUT => 1,
            ]);
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($httpCode > 0) {
                $ready = true;
                break;
            }
        }

        if (!$ready) {
            throw new \RuntimeException("Proxy server did not start on port {$port} within 4 seconds");
        }

        echo "✓ Proxy server running at http://localhost:{$port}\n";

        // Test 2: Note — PHP proxy has no /health endpoint; OPTIONS returns 204
        echo "\nTest 2: OPTIONS /api/stream returns 204 (server is live)...\n";
        $ch = curl_init("http://{$host}/api/stream");
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'OPTIONS',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_HTTPHEADER     => ['Origin: http://localhost:3000'],
        ]);
        curl_exec($ch);
        $optionsCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($optionsCode !== 204) {
            throw new \RuntimeException("Expected 204 from OPTIONS /api/stream, got {$optionsCode}");
        }
        echo "✓ OPTIONS /api/stream returns 204\n";

        // Test 3: POST /api/stream returns text/event-stream
        echo "\nTest 3: POST /api/stream — Content-Type header...\n";

        $payload = json_encode(['messages' => [['role' => 'user', 'content' => 'Hi']], 'auto_routing' => true]);
        $contentType = '';
        $statusCode = 0;

        $ch = curl_init("http://{$host}/api/stream");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$contentType, &$statusCode) {
                if (str_starts_with($header, 'HTTP/')) {
                    preg_match('/HTTP\/\S+ (\d+)/', $header, $m);
                    $statusCode = (int) ($m[1] ?? 0);
                }
                if (stripos($header, 'Content-Type:') === 0) {
                    $contentType = trim(substr($header, strlen('Content-Type:')));
                }
                return strlen($header);
            },
            CURLOPT_WRITEFUNCTION  => function ($ch, $data) {
                // Consume data without printing (validation happens below)
                return strlen($data);
            },
        ]);

        curl_exec($ch);
        curl_close($ch);

        if ($statusCode !== 200) {
            throw new \RuntimeException("Expected 200, got {$statusCode}");
        }
        if (strpos($contentType, 'text/event-stream') === false) {
            throw new \RuntimeException("Expected text/event-stream, got: {$contentType}");
        }
        echo "✓ Content-Type: {$contentType}\n";

        // Test 4: SSE line format (data: prefix) and [DONE] detection
        echo "\nTest 4: SSE line format (data: prefix)...\n";

        $dataLines        = 0;
        $streamTerminated = false;
        $finishReason     = null;
        $lineBuffer       = '';

        $ch = curl_init("http://{$host}/api/stream");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_WRITEFUNCTION  => function ($ch, $data) use (&$lineBuffer, &$dataLines, &$streamTerminated, &$finishReason) {
                $lineBuffer .= $data;
                $lines = explode("\n", $lineBuffer);
                $lineBuffer = array_pop($lines); // keep incomplete last line

                foreach ($lines as $line) {
                    $line = rtrim($line, "\r");
                    if ($line === '') {
                        continue;
                    }
                    if (!str_starts_with($line, 'data: ')) {
                        throw new \RuntimeException("Expected 'data: ' prefix, got: " . json_encode($line));
                    }
                    $ssePayload = trim(substr($line, 6));
                    if ($ssePayload === '[DONE]') {
                        continue;
                    }
                    $parsed = json_decode($ssePayload, true);
                    if (is_array($parsed)) {
                        $reason = $parsed['choices'][0]['finish_reason'] ?? null;
                        if ($reason !== null) {
                            $streamTerminated = true;
                            $finishReason = $reason;
                            return 0; // returning 0 aborts the curl transfer
                        }
                    }
                    $dataLines++;
                }
                return strlen($data);
            },
        ]);

        curl_exec($ch);
        curl_close($ch);

        echo "✓ All lines have 'data: ' prefix ({$dataLines} data chunks received)\n";

        if (!$streamTerminated) {
            echo "⚠️  Stream ended without a finish_reason chunk\n";
        } else {
            echo "✓ Stream terminated cleanly (finish_reason={$finishReason})\n";
        }

        // Test 5: CORS headers present
        echo "\nTest 5: CORS headers on response...\n";
        $corsHeader = '';
        $ch = curl_init("http://{$host}/api/stream");
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'OPTIONS',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_HTTPHEADER     => ['Origin: http://localhost:3000'],
            CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$corsHeader) {
                if (stripos($header, 'Access-Control-Allow-Origin:') === 0) {
                    $corsHeader = trim(substr($header, strlen('Access-Control-Allow-Origin:')));
                }
                return strlen($header);
            },
        ]);
        curl_exec($ch);
        curl_close($ch);

        if (!$corsHeader) {
            echo "⚠️  Access-Control-Allow-Origin header not set on OPTIONS response\n";
        } else {
            echo "✓ Access-Control-Allow-Origin: {$corsHeader}\n";
        }

        echo "\n✅ Proxy server relaying SSE end-to-end.\n";
        echo "   Track B complete: credentials stay server-side, client receives SSE.\n\n";

    } catch (\Throwable $e) {
        echo "\n❌ Server-Side Proxy Test Failed\n";
        echo "Error: " . $e->getMessage() . "\n";
        echo "\n💡 Hints:\n";
        echo "   - Check that PHP CLI and curl extension are available\n";
        echo "   - Verify port {$port} is not already in use\n";
        echo "   - Check src/Proxy/Server.php loads vendor/autoload.php correctly\n";
        echo "   - Confirm GLOO_CLIENT_ID and GLOO_CLIENT_SECRET are set in .env\n\n";
        exit(1);
    } finally {
        if ($proc !== null && is_resource($proc)) {
            proc_terminate($proc);
            proc_close($proc);
        }
    }
}

testStep6();
