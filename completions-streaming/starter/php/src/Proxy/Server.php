<?php

declare(strict_types=1);

namespace GlooStreaming\Proxy;

use GlooStreaming\Auth\TokenManager;

/**
 * SSE proxy server for streaming completions.
 *
 * Relays streaming requests from the browser to the Gloo AI API,
 * forwarding the SSE stream back to the client via ob_flush loop.
 * This avoids exposing API credentials in the browser.
 *
 * Usage: Point your web server at this file for /api/stream requests,
 * or run it directly with PHP's built-in server:
 *   php -S localhost:3001 -t src/Proxy
 */
class Server
{
    private const API_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

    /**
     * Handle an incoming SSE proxy request.
     *
     * Sets SSE headers and relays the upstream stream back to the client.
     */
    public static function handle(): void
    {
        // TODO: Implement the PHP SSE proxy handler (Step 8):
        // 1. Set SSE response headers: Content-Type: text/event-stream, Cache-Control: no-cache,
        //    X-Accel-Buffering: no, Access-Control-Allow-Origin: $corsOrigin
        // 2. Handle OPTIONS preflight: send 204 and exit
        // 3. Reject non-POST with 405 and exit
        // 4. Parse request body: $body = json_decode(file_get_contents('php://input'), true) ?? []
        // 5. Add stream: true to body payload
        // 6. Get auth token: $token = TokenManager::ensureValidToken()
        // 7. Set up cURL with CURLOPT_WRITEFUNCTION that for each $data chunk:
        //    a. Splits on "\n" and forwards non-blank lines as SSE frames: echo "$line\n\n"
        //    b. Calls ob_flush() + flush() after each chunk
        // 8. Execute curl_exec() and curl_close()
        throw new \RuntimeException('Not implemented - see TODO comments');
    }
}

// If this file is executed directly (e.g., via PHP built-in server)
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    // Load autoloader and env
    $root = dirname(__DIR__, 2);
    if (file_exists($root . '/vendor/autoload.php')) {
        require_once $root . '/vendor/autoload.php';
    }
    if (class_exists('\Dotenv\Dotenv')) {
        $dotenv = \Dotenv\Dotenv::createImmutable($root);
        $dotenv->safeLoad();
    }

    Server::handle();
}
