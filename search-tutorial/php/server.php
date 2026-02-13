<?php
/**
 * Gloo AI Search API - Proxy Server (PHP Built-in Server)
 *
 * A lightweight server that proxies search requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Start with:
 *   php -S localhost:3000 server.php
 *
 * Endpoints:
 *   GET  /api/search?q=<query>&limit=<limit>  - Basic search
 *   POST /api/search/rag                       - Search + RAG with Completions V2
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/search_basic.php';
require_once __DIR__ . '/search_advanced.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// --- Configuration ---
$CLIENT_ID = $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID';
$CLIENT_SECRET = $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET';
$TENANT = $_ENV['GLOO_TENANT'] ?? 'your-tenant-name';

$TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
$SEARCH_URL = 'https://platform.ai.gloo.com/ai/data/v1/search';
$COMPLETIONS_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';
$RAG_MAX_TOKENS = (int) ($_ENV['RAG_MAX_TOKENS'] ?? 3000);
$RAG_CONTEXT_MAX_SNIPPETS = (int) ($_ENV['RAG_CONTEXT_MAX_SNIPPETS'] ?? 5);
$RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = (int) ($_ENV['RAG_CONTEXT_MAX_CHARS_PER_SNIPPET'] ?? 350);

validateCredentials($CLIENT_ID, $CLIENT_SECRET);

// Shared instances
$tokenManager = new TokenManager($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
$searchClient = new SearchClient($tokenManager, $SEARCH_URL, $TENANT);
$advancedSearchClient = new AdvancedSearchClient($tokenManager, $SEARCH_URL, $TENANT);
$ragHelper = new RAGHelper($tokenManager, $COMPLETIONS_URL, $RAG_MAX_TOKENS);

$FRONTEND_DIR = realpath(__DIR__ . '/../frontend-example/simple-html');

// --- Request Handling ---
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($uri, PHP_URL_PATH);

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// API: Basic search
if ($path === '/api/search' && $method === 'GET') {
    header('Content-Type: application/json');

    parse_str(parse_url($uri, PHP_URL_QUERY) ?? '', $queryParams);
    $q = $queryParams['q'] ?? '';
    $limit = (int) ($queryParams['limit'] ?? 10);

    if (empty($q)) {
        http_response_code(400);
        echo json_encode(['error' => "Query parameter 'q' is required"]);
        exit;
    }

    try {
        $results = $searchClient->search($q, $limit);
        echo json_encode($results);
    } catch (Exception $e) {
        fwrite(STDERR, "Search error: " . $e->getMessage() . "\n");
        http_response_code(500);
        echo json_encode(['error' => 'Search request failed']);
    }
    exit;
}

// API: RAG search
if ($path === '/api/search/rag' && $method === 'POST') {
    header('Content-Type: application/json');

    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body || empty($body['query'])) {
        http_response_code(400);
        echo json_encode(['error' => "Field 'query' is required"]);
        exit;
    }

    $query = $body['query'];
    $limit = (int) ($body['limit'] ?? 5);
    $systemPrompt = $body['systemPrompt'] ?? null;

    try {
        // Step 1: Search
        $results = $advancedSearchClient->search($query, $limit);

        if (empty($results['data'])) {
            echo json_encode(['response' => 'No relevant content found.', 'sources' => []]);
            exit;
        }

        // Step 2: Extract snippets and format context
        $snippetLimit = min($limit, $RAG_CONTEXT_MAX_SNIPPETS);
        $snippets = $ragHelper->extractSnippets($results, $snippetLimit, $RAG_CONTEXT_MAX_CHARS_PER_SNIPPET);
        $context = $ragHelper->formatContextForLLM($snippets);

        // Step 3: Generate response
        $generatedResponse = $ragHelper->generateWithContext($query, $context, $systemPrompt);

        echo json_encode([
            'response' => $generatedResponse,
            'sources' => array_map(fn($s) => ['title' => $s['title'], 'type' => $s['type']], $snippets),
        ]);
    } catch (Exception $e) {
        fwrite(STDERR, "RAG error: " . $e->getMessage() . "\n");
        http_response_code(500);
        echo json_encode(['error' => 'RAG request failed']);
    }
    exit;
}

// Serve frontend static files
if ($path === '/' || $path === '') {
    $path = '/index.html';
}

$filePath = $FRONTEND_DIR . $path;

if (file_exists($filePath) && is_file($filePath)) {
    // Set content type
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
    ];
    header('Content-Type: ' . ($mimeTypes[$ext] ?? 'application/octet-stream'));
    readfile($filePath);
    exit;
}

// 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found']);
