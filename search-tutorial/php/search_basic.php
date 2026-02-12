<?php
/**
 * Gloo AI Search API - Basic PHP Example
 *
 * This script demonstrates how to use the Gloo AI Search API
 * to perform semantic search on your ingested content.
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/auth.php';

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

class SearchClient
{
    private TokenManager $tokenManager;
    private string $searchUrl;
    private string $tenant;

    public function __construct(TokenManager $tokenManager, string $searchUrl, string $tenant)
    {
        $this->tokenManager = $tokenManager;
        $this->searchUrl = $searchUrl;
        $this->tenant = $tenant;
    }

    /**
     * Perform a semantic search query.
     */
    public function search(string $query, int $limit = 10): array
    {
        $token = $this->tokenManager->ensureValidToken();

        $payload = json_encode([
            'query' => $query,
            'collection' => 'GlooProd',
            'tenant' => $this->tenant,
            'limit' => $limit,
            'certainty' => 0.5,
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->searchUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $result = curl_exec($ch);

        if (curl_errno($ch)) {
            throw new Exception('Search request failed: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            fwrite(STDERR, "Search failed with status $httpCode: $result\n");
            throw new Exception("Search request failed: HTTP $httpCode");
        }

        return json_decode($result, true);
    }
}

/**
 * Perform a basic search and display results.
 */
function basicSearch(SearchClient $searchClient, string $query, int $limit = 10): void
{
    echo "Searching for: '$query'\n";
    echo "Limit: $limit results\n\n";

    $results = $searchClient->search($query, $limit);

    if (empty($results['data'])) {
        echo "No results found.\n";
        return;
    }

    echo "Found " . count($results['data']) . " results:\n\n";

    foreach ($results['data'] as $i => $result) {
        $props = $result['properties'] ?? [];
        $metadata = $result['metadata'] ?? [];

        echo "--- Result " . ($i + 1) . " ---\n";
        echo "Title: " . ($props['item_title'] ?? 'N/A') . "\n";
        echo "Type: " . ($props['type'] ?? 'N/A') . "\n";
        echo "Author: " . implode(', ', $props['author'] ?? ['N/A']) . "\n";
        echo "Relevance Score: " . number_format($metadata['certainty'] ?? 0, 4) . "\n";

        $snippet = $props['snippet'] ?? '';
        if ($snippet) {
            echo "Snippet: " . substr($snippet, 0, 200) . "...\n";
        }

        echo "\n";
    }
}

function printBasicUsage(): void
{
    echo "Usage:\n";
    echo "  php search_basic.php <query> [limit]\n\n";
    echo "Examples:\n";
    echo "  php search_basic.php \"How can I know my purpose?\"\n";
    echo "  php search_basic.php \"purpose\" 5\n";
}

// --- Main ---
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    validateCredentials($CLIENT_ID, $CLIENT_SECRET);

    if ($argc < 2) {
        printBasicUsage();
        exit(1);
    }

    $query = $argv[1];
    $limit = isset($argv[2]) ? (int) $argv[2] : 10;

    try {
        $tokenManager = new TokenManager($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
        $searchClient = new SearchClient($tokenManager, $SEARCH_URL, $TENANT);
        basicSearch($searchClient, $query, $limit);
    } catch (Exception $e) {
        fwrite(STDERR, "An error occurred: " . $e->getMessage() . "\n");
        exit(1);
    }
}
