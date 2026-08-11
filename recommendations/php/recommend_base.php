<?php
/**
 * Gloo AI Recommendations API - Base Recommendations
 *
 * Fetches publisher-scoped item recommendations with snippet metadata
 * but without snippet text — ideal for a clean recommendations list.
 *
 * Usage:
 *   php recommend_base.php <query> [item_count]
 *
 * Examples:
 *   php recommend_base.php "How do I deal with anxiety?"
 *   php recommend_base.php "parenting teenagers" 3
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config.php';

$config = loadConfig();
$API_KEY     = $config['API_KEY'];
$TENANT      = $config['TENANT'];
$COLLECTION  = $config['COLLECTION'];
$BASE_URL    = $config['RECOMMENDATIONS_BASE_URL'];
$DEFAULT_ITEM_COUNT = $config['DEFAULT_ITEM_COUNT'];

function validateApiKey(string $apiKey): void
{
    if (empty($apiKey)) {
        fwrite(STDERR, "Error: GLOO_API_KEY must be set\n");
        echo "Create a .env file with your API key:\n";
        echo "GLOO_API_KEY=your_api_key_here\n";
        echo "GLOO_TENANT=your_tenant_name_here\n";
        echo "GLOO_COLLECTION=GlooProd\n";
        exit(1);
    }
}

class RecommendationsClient
{
    private string $apiKey;
    private string $baseUrl;
    private string $collection;
    private string $tenant;

    public function __construct(
        string $apiKey,
        string $baseUrl,
        string $collection,
        string $tenant
    ) {
        $this->apiKey     = $apiKey;
        $this->baseUrl    = $baseUrl;
        $this->collection = $collection;
        $this->tenant     = $tenant;
    }

    /**
     * Fetch publisher-scoped recommendations (metadata only, no snippet text).
     */
    public function getBase(string $query, int $itemCount = 5): array
    {
        $payload = json_encode([
            'query'               => $query,
            'collection'          => $this->collection,
            'tenant'              => $this->tenant,
            'item_count'          => $itemCount,
            'certainty_threshold' => 0.75,
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->baseUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $result = curl_exec($ch);

        if (curl_errno($ch)) {
            throw new Exception('Recommendations request failed: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            fwrite(STDERR, "Request failed with status $httpCode: $result\n");
            throw new Exception("Recommendations request failed: HTTP $httpCode");
        }

        return json_decode($result, true);
    }
}

function runBase(RecommendationsClient $client, string $query, int $itemCount): void
{
    echo "Fetching recommendations for: '$query'\n";
    echo "Requesting up to $itemCount items\n\n";

    $items = $client->getBase($query, $itemCount);

    if (empty($items)) {
        echo "No recommendations found.\n";
        return;
    }

    echo "Found " . count($items) . " recommended item(s):\n\n";

    foreach ($items as $i => $item) {
        echo "--- Item " . ($i + 1) . " ---\n";
        echo "Title:  " . ($item['item_title'] ?? 'N/A') . "\n";

        $authors = $item['author'] ?? [];
        if (!empty($authors)) {
            echo "Author: " . implode(', ', $authors) . "\n";
        }

        // uuids holds the matched snippets with relevance scores
        $uuids = $item['uuids'] ?? [];
        if (!empty($uuids)) {
            $top = $uuids[0];
            echo "Relevance: " . number_format($top['certainty'] ?? 0, 2) . "\n";
            if (!empty($top['ai_title'])) {
                echo "Section:   " . $top['ai_title'] . "\n";
            }
            if (!empty($top['item_summary'])) {
                echo "Summary:   " . substr($top['item_summary'], 0, 200) . "\n";
            }
        }

        if (!empty($item['item_url'])) {
            echo "URL:    " . $item['item_url'] . "\n";
        }

        echo "\n";
    }
}

function printBaseUsage(): void
{
    echo "Usage:\n";
    echo "  php recommend_base.php <query> [item_count]\n\n";
    echo "Arguments:\n";
    echo "  query       Topic or question to find recommendations for (required)\n";
    echo "  item_count  Max items to return (optional, default: 5)\n\n";
    echo "Examples:\n";
    echo "  php recommend_base.php \"How do I deal with anxiety?\"\n";
    echo "  php recommend_base.php \"parenting teenagers\" 3\n";
}

// --- Main ---
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    validateApiKey($API_KEY);

    if ($argc < 2) {
        printBaseUsage();
        exit(1);
    }

    $query     = $argv[1];
    $itemCount = isset($argv[2]) ? parseItemCount($argv[2], $DEFAULT_ITEM_COUNT) : $DEFAULT_ITEM_COUNT;

    try {
        $client = new RecommendationsClient($API_KEY, $BASE_URL, $COLLECTION, $TENANT);
        runBase($client, $query, $itemCount);
    } catch (Exception $e) {
        fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
        exit(1);
    }
}
