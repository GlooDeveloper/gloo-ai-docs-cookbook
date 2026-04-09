<?php
/**
 * Gloo AI Recommendations API - Affiliate Referenced Items
 *
 * Surfaces relevant items from across the Gloo affiliate publisher network,
 * enabling cross-publisher discovery for "Explore more resources" features.
 *
 * Unlike the publisher-scoped endpoints, this endpoint does not require a
 * collection or tenant — it searches across the entire affiliate network.
 *
 * Usage:
 *   php recommend_affiliates.php <query> [item_count]
 *
 * Examples:
 *   php recommend_affiliates.php "How do I deal with anxiety?"
 *   php recommend_affiliates.php "parenting teenagers" 3
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/config.php';

$config = loadConfig();
$CLIENT_ID   = $config['CLIENT_ID'];
$CLIENT_SECRET = $config['CLIENT_SECRET'];
$TOKEN_URL   = $config['TOKEN_URL'];
$AFFILIATES_URL = $config['AFFILIATES_URL'];
$DEFAULT_ITEM_COUNT = $config['DEFAULT_ITEM_COUNT'];

class AffiliatesClient
{
    private TokenManager $tokenManager;
    private string $affiliatesUrl;

    public function __construct(TokenManager $tokenManager, string $affiliatesUrl)
    {
        $this->tokenManager  = $tokenManager;
        $this->affiliatesUrl = $affiliatesUrl;
    }

    /**
     * Fetch relevant items from across the Gloo affiliate publisher network.
     * No collection or tenant required — results span the full affiliate network.
     */
    public function getReferencedItems(string $query, int $itemCount = 5): array
    {
        $token = $this->tokenManager->ensureValidToken();

        $payload = json_encode([
            'query'               => $query,
            'item_count'          => $itemCount,
            'certainty_threshold' => 0.75,
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->affiliatesUrl);
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
            throw new Exception('Affiliates request failed: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            fwrite(STDERR, "Request failed with status $httpCode: $result\n");
            throw new Exception("Affiliates request failed: HTTP $httpCode");
        }

        return json_decode($result, true);
    }
}

function runAffiliates(AffiliatesClient $client, string $query, int $itemCount): void
{
    echo "Fetching affiliate recommendations for: '$query'\n";
    echo "Searching across the Gloo affiliate network...\n";
    echo "Requesting up to $itemCount items\n\n";

    $items = $client->getReferencedItems($query, $itemCount);

    if (empty($items)) {
        echo "No affiliate items found.\n";
        return;
    }

    echo "Found " . count($items) . " item(s) from across the affiliate network:\n\n";

    foreach ($items as $i => $item) {
        echo "--- Item " . ($i + 1) . " ---\n";
        echo "Title:     " . ($item['item_title'] ?? 'N/A') . "\n";

        $authors = $item['author'] ?? [];
        if (!empty($authors)) {
            echo "Author:    " . implode(', ', $authors) . "\n";
        }

        if (!empty($item['tradition'])) {
            echo "Tradition: " . $item['tradition'] . "\n";
        }
        if (!empty($item['item_subtitle'])) {
            echo "Subtitle:  " . $item['item_subtitle'] . "\n";
        }
        if (!empty($item['item_url'])) {
            echo "URL:       " . $item['item_url'] . "\n";
        }

        echo "\n";
    }
}

function printAffiliatesUsage(): void
{
    echo "Usage:\n";
    echo "  php recommend_affiliates.php <query> [item_count]\n\n";
    echo "Arguments:\n";
    echo "  query       Topic or question to find resources for (required)\n";
    echo "  item_count  Max items to return (optional, default: 5)\n\n";
    echo "Examples:\n";
    echo "  php recommend_affiliates.php \"How do I deal with anxiety?\"\n";
    echo "  php recommend_affiliates.php \"parenting teenagers\" 3\n";
}

// --- Main ---
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    validateCredentials($CLIENT_ID, $CLIENT_SECRET);

    if ($argc < 2) {
        printAffiliatesUsage();
        exit(1);
    }

    $query     = $argv[1];
    $itemCount = isset($argv[2]) ? parseItemCount($argv[2], $DEFAULT_ITEM_COUNT) : $DEFAULT_ITEM_COUNT;

    try {
        $tokenManager = new TokenManager($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
        $client = new AffiliatesClient($tokenManager, $AFFILIATES_URL);
        runAffiliates($client, $query, $itemCount);
    } catch (Exception $e) {
        fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
        exit(1);
    }
}
