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
        $corsOrigin = $_ENV['PROXY_CORS_ORIGIN'] ?? getenv('PROXY_CORS_ORIGIN') ?: 'http://localhost:3000';

        header('Access-Control-Allow-Origin: ' . $corsOrigin);
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: POST, OPTIONS');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        if ($path === '/health') {
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'ok', 'service' => 'completions-streaming-proxy']);
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');

        // Disable PHP output buffering
        while (ob_get_level() > 0) {
            ob_end_flush();
        }

        try {
            $authToken = TokenManager::ensureValidToken();
            $rawBody = file_get_contents('php://input');
            $body = json_decode($rawBody, true) ?? [];
            $body['stream'] = true;

            $payload = json_encode($body);
            $headers = [
                'Authorization: Bearer ' . $authToken,
                'Content-Type: application/json',
            ];

            $ch = curl_init(self::API_URL);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_WRITEFUNCTION => function ($ch, $data) {
                    // Forward each chunk of SSE data to the client
                    foreach (explode("\n", $data) as $line) {
                        if (trim($line)) {
                            echo $line . "\n\n";
                            flush();
                        }
                    }
                    return strlen($data);
                },
            ]);

            curl_exec($ch);
            $error = curl_error($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($error) {
                echo 'data: {"error": "' . addslashes($error) . '"}' . "\n\n";
                flush();
            } elseif ($status !== 200) {
                echo 'data: {"error": "API error ' . $status . '"}' . "\n\n";
                flush();
            }
        } catch (\Throwable $e) {
            echo 'data: {"error": "' . addslashes($e->getMessage()) . '"}' . "\n\n";
            flush();
        }
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
