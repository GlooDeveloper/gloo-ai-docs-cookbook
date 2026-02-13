<?php
/**
 * Gloo AI Search API - Advanced PHP Example
 *
 * This script demonstrates advanced search features including:
 * - Filtering and pagination
 * - RAG (Retrieval Augmented Generation) helpers
 * - Integration with Completions V2 API
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
$COMPLETIONS_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';
$RAG_MAX_TOKENS = (int) ($_ENV['RAG_MAX_TOKENS'] ?? 3000);
$RAG_CONTEXT_MAX_SNIPPETS = (int) ($_ENV['RAG_CONTEXT_MAX_SNIPPETS'] ?? 5);
$RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = (int) ($_ENV['RAG_CONTEXT_MAX_CHARS_PER_SNIPPET'] ?? 350);

class AdvancedSearchClient
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
     * Perform an advanced semantic search query.
     */
    public function search(string $query, int $limit = 10, string $sortBy = 'relevance'): array
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

        $results = json_decode($result, true);

        if ($sortBy === 'certainty' && !empty($results['data'])) {
            usort($results['data'], function ($a, $b) {
                return ($b['metadata']['certainty'] ?? 0) <=> ($a['metadata']['certainty'] ?? 0);
            });
        }

        return $results;
    }

    /**
     * Filter search results by content type.
     */
    public function filterByContentType(array $results, array $contentTypes): array
    {
        if (empty($results['data'])) {
            return $results;
        }

        $results['data'] = array_values(array_filter($results['data'], function ($result) use ($contentTypes) {
            return in_array($result['properties']['type'] ?? '', $contentTypes);
        }));

        return $results;
    }
}

class RAGHelper
{
    private TokenManager $tokenManager;
    private string $completionsUrl;
    private int $ragMaxTokens;

    public function __construct(TokenManager $tokenManager, string $completionsUrl, int $ragMaxTokens = 3000)
    {
        $this->tokenManager = $tokenManager;
        $this->completionsUrl = $completionsUrl;
        $this->ragMaxTokens = $ragMaxTokens > 0 ? $ragMaxTokens : 3000;
    }

    /**
     * Extract and format snippets from search results for RAG.
     */
    public function extractSnippets(array $results, int $maxSnippets = 5, int $maxCharsPerSnippet = 500): array
    {
        if (empty($results['data'])) {
            return [];
        }

        $snippets = [];
        foreach (array_slice($results['data'], 0, $maxSnippets) as $result) {
            $props = $result['properties'] ?? [];
            $snippets[] = [
                'text' => substr($props['snippet'] ?? '', 0, $maxCharsPerSnippet),
                'title' => $props['item_title'] ?? 'N/A',
                'type' => $props['type'] ?? 'N/A',
                'relevance' => $result['metadata']['certainty'] ?? 0,
            ];
        }

        return $snippets;
    }

    /**
     * Format extracted snippets as context for LLM.
     */
    public function formatContextForLLM(array $snippets): string
    {
        $parts = [];
        foreach ($snippets as $i => $snippet) {
            $num = $i + 1;
            $parts[] = "[Source $num: {$snippet['title']} ({$snippet['type']})]\n{$snippet['text']}\n";
        }
        return implode("\n---\n", $parts);
    }

    /**
     * Call Completions V2 API with custom context.
     */
    public function generateWithContext(string $query, string $context, ?string $systemPrompt = null): string
    {
        $token = $this->tokenManager->ensureValidToken();

        if (!$systemPrompt) {
            $systemPrompt = 'You are a helpful assistant. Answer the user\'s question based on the '
                . 'provided context. If the context doesn\'t contain relevant information, '
                . 'say so honestly.';
        }

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => "Context:\n$context\n\nQuestion: $query"],
        ];

        $payload = json_encode([
            'messages' => $messages,
            'auto_routing' => true,
            'max_tokens' => $this->ragMaxTokens,
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->completionsUrl);
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
            throw new Exception('Completions request failed: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            fwrite(STDERR, "Completions API failed: $result\n");
            throw new Exception("Completions request failed: HTTP $httpCode");
        }

        $data = json_decode($result, true);
        return $data['choices'][0]['message']['content'] ?? '';
    }
}

/**
 * Execute a search with content type filtering.
 */
function filteredSearch(AdvancedSearchClient $searchClient, string $query, array $contentTypes, int $limit = 10): void
{
    echo "Searching for: '$query'\n";
    echo "Content types: " . implode(', ', $contentTypes) . "\n";
    echo "Limit: $limit\n\n";

    $results = $searchClient->search($query, $limit);
    $filtered = $searchClient->filterByContentType($results, $contentTypes);

    if (empty($filtered['data'])) {
        echo "No results found matching filters.\n";
        return;
    }

    echo "Found " . count($filtered['data']) . " results:\n\n";

    foreach ($filtered['data'] as $i => $result) {
        $props = $result['properties'] ?? [];
        $num = $i + 1;
        echo "$num. " . ($props['item_title'] ?? 'N/A') . " (" . ($props['type'] ?? 'N/A') . ")\n";
    }
}

/**
 * Execute a search and use results for RAG with Completions API.
 */
function ragSearch(AdvancedSearchClient $searchClient, RAGHelper $ragHelper, string $query, int $limit = 5): void
{
    global $RAG_CONTEXT_MAX_SNIPPETS, $RAG_CONTEXT_MAX_CHARS_PER_SNIPPET;

    echo "RAG Search for: '$query'\n\n";

    echo "Step 1: Searching for relevant content...\n";
    $results = $searchClient->search($query, $limit);

    if (empty($results['data'])) {
        echo "No results found.\n";
        return;
    }

    echo "Found " . count($results['data']) . " results\n\n";

    echo "Step 2: Extracting snippets...\n";
    $snippetLimit = min($limit, $RAG_CONTEXT_MAX_SNIPPETS);
    $snippets = $ragHelper->extractSnippets($results, $snippetLimit, $RAG_CONTEXT_MAX_CHARS_PER_SNIPPET);
    $context = $ragHelper->formatContextForLLM($snippets);
    echo "Extracted " . count($snippets) . " snippets\n\n";

    echo "Step 3: Generating response with context...\n\n";
    $response = $ragHelper->generateWithContext($query, $context);

    echo "=== Generated Response ===\n";
    echo $response . "\n";
    echo "\n=== Sources Used ===\n";
    foreach ($snippets as $snippet) {
        echo "- {$snippet['title']} ({$snippet['type']})\n";
    }
}

function printAdvancedUsage(): void
{
    echo "Usage:\n";
    echo "  php search_advanced.php filter <query> <types> [limit]\n";
    echo "  php search_advanced.php rag <query> [limit]\n\n";
    echo "Examples:\n";
    echo "  php search_advanced.php filter \"purpose\" \"Article,Video\" 10\n";
    echo "  php search_advanced.php rag \"How can I know my purpose?\" 5\n";
}

// --- Main ---
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    validateCredentials($CLIENT_ID, $CLIENT_SECRET);

    if ($argc < 3) {
        printAdvancedUsage();
        exit(1);
    }

    $command = strtolower($argv[1]);
    $query = $argv[2];

    try {
        $tokenManager = new TokenManager($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
        $searchClient = new AdvancedSearchClient($tokenManager, $SEARCH_URL, $TENANT);
        $ragHelper = new RAGHelper($tokenManager, $COMPLETIONS_URL, $RAG_MAX_TOKENS);

        if ($command === 'filter') {
            if ($argc < 4) {
                fwrite(STDERR, "Error: Content types required for filter command\n");
                printAdvancedUsage();
                exit(1);
            }
            $types = explode(',', $argv[3]);
            $limit = isset($argv[4]) ? (int) $argv[4] : 10;
            filteredSearch($searchClient, $query, $types, $limit);
        } elseif ($command === 'rag') {
            $limit = isset($argv[3]) ? (int) $argv[3] : 5;
            ragSearch($searchClient, $ragHelper, $query, $limit);
        } else {
            fwrite(STDERR, "Error: Unknown command '$command'\n");
            printAdvancedUsage();
            exit(1);
        }
    } catch (Exception $e) {
        fwrite(STDERR, "An error occurred: " . $e->getMessage() . "\n");
        exit(1);
    }
}
