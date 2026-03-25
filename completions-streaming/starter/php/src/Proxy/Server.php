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
        // 1. Set CORS and SSE response headers, then handle OPTIONS preflight requests
        // 2. Reject non-POST requests with a 405 response
        // 3. Read and parse the incoming request body, adding stream set to true
        // 4. Retrieve the server-side auth token
        // 5. Set up a cURL write callback that forwards each non-blank SSE line to the client and flushes
        // 6. Execute and close the cURL handle
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
