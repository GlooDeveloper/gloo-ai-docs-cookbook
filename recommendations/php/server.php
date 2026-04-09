<?php
/**
 * Gloo AI Recommendations API - Proxy Server (PHP Built-in Server)
 *
 * A lightweight server that proxies recommendation requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Start with:
 *   php -S localhost:3000 server.php
 *
 * Endpoints:
 *   POST /api/recommendations/base       - Publisher-scoped recommendations (metadata only)
 *   POST /api/recommendations/verbose    - Publisher-scoped recommendations (with snippet text)
 *   POST /api/recommendations/affiliates - Cross-publisher affiliate network recommendations
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/recommend_base.php';
require_once __DIR__ . '/recommend_verbose.php';
require_once __DIR__ . '/recommend_affiliates.php';

$config        = loadConfig();
$CLIENT_ID     = $config['CLIENT_ID'];
$CLIENT_SECRET = $config['CLIENT_SECRET'];
$TENANT        = $config['TENANT'];
$COLLECTION    = $config['COLLECTION'];
$TOKEN_URL     = $config['TOKEN_URL'];
$DEFAULT_ITEM_COUNT = $config['DEFAULT_ITEM_COUNT'];

validateCredentials($CLIENT_ID, $CLIENT_SECRET);

// Shared token manager and API clients
$tokenManager    = new TokenManager($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
$baseClient      = new RecommendationsClient($tokenManager, $config['RECOMMENDATIONS_BASE_URL'], $COLLECTION, $TENANT);
$verboseClient   = new VerboseRecommendationsClient($tokenManager, $config['RECOMMENDATIONS_VERBOSE_URL'], $COLLECTION, $TENANT);
$affiliatesClient = new AffiliatesClient($tokenManager, $config['AFFILIATES_URL']);

$FRONTEND_DIR = realpath(__DIR__ . '/../frontend-example/simple-html');

// --- Request Handling ---
$uri    = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = parse_url($uri, PHP_URL_PATH);

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Helper: read and validate JSON body
function requireJsonBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || empty($body['query'])) {
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => "Field 'query' is required"]);
        exit;
    }
    return $body;
}

// POST /api/recommendations/base
if ($path === '/api/recommendations/base' && $method === 'POST') {
    header('Content-Type: application/json');
    $body      = requireJsonBody();
    $query     = $body['query'];
    $itemCount = parseItemCount($body['item_count'] ?? null, $DEFAULT_ITEM_COUNT);

    try {
        echo json_encode($baseClient->getBase($query, $itemCount));
    } catch (Exception $e) {
        fwrite(STDERR, "Base recommendations error: " . $e->getMessage() . "\n");
        http_response_code(500);
        echo json_encode(['error' => 'Base recommendations request failed']);
    }
    exit;
}

// POST /api/recommendations/verbose
if ($path === '/api/recommendations/verbose' && $method === 'POST') {
    header('Content-Type: application/json');
    $body      = requireJsonBody();
    $query     = $body['query'];
    $itemCount = parseItemCount($body['item_count'] ?? null, $DEFAULT_ITEM_COUNT);

    try {
        echo json_encode($verboseClient->getVerbose($query, $itemCount));
    } catch (Exception $e) {
        fwrite(STDERR, "Verbose recommendations error: " . $e->getMessage() . "\n");
        http_response_code(500);
        echo json_encode(['error' => 'Verbose recommendations request failed']);
    }
    exit;
}

// POST /api/recommendations/affiliates
if ($path === '/api/recommendations/affiliates' && $method === 'POST') {
    header('Content-Type: application/json');
    $body      = requireJsonBody();
    $query     = $body['query'];
    $itemCount = parseItemCount($body['item_count'] ?? null, $DEFAULT_ITEM_COUNT);

    try {
        echo json_encode($affiliatesClient->getReferencedItems($query, $itemCount));
    } catch (Exception $e) {
        fwrite(STDERR, "Affiliates error: " . $e->getMessage() . "\n");
        http_response_code(500);
        echo json_encode(['error' => 'Affiliates request failed']);
    }
    exit;
}

// Serve frontend static files
if ($path === '/' || $path === '') {
    $path = '/index.html';
}

$filePath = $FRONTEND_DIR . $path;

if ($FRONTEND_DIR && file_exists($filePath) && is_file($filePath)) {
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'json' => 'application/json',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'svg'  => 'image/svg+xml',
    ];
    header('Content-Type: ' . ($mimeTypes[$ext] ?? 'application/octet-stream'));
    readfile($filePath);
    exit;
}

// 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found']);
