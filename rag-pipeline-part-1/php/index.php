<?php

declare(strict_types=1);

/**
 * Gloo AI RAG Pipeline - Part 1: Set Up the Pipeline (PHP)
 *
 * Uploads sample content to a publisher, enriches it with metadata,
 * and polls the Data Engine until the item is fully indexed.
 */

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// --- Configuration ---
define('CLIENT_ID', $_ENV['GLOO_CLIENT_ID'] ?? '');
define('CLIENT_SECRET', $_ENV['GLOO_CLIENT_SECRET'] ?? '');
define('PUBLISHER_ID', $_ENV['GLOO_PUBLISHER_ID'] ?? '');

define('API_ROOT', 'https://platform.ai.gloo.com');
define('TOKEN_URL', API_ROOT . '/oauth2/token');
define('UPLOAD_URL', API_ROOT . '/ingestion/v2/files');
define('ITEM_METADATA_URL', API_ROOT . '/engine/v2/item');
define('ITEM_STATUS_URL', API_ROOT . '/engine/v2/items');

define('SAMPLE_FILE', __DIR__ . '/../sample_files/building-stronger-communities.md');
define('PRODUCER_ID', 'rag-pipeline-part1-building-stronger-communities');

// Polling configuration: ingestion is asynchronous and typically
// takes several minutes (observed ~6 minutes for a small file).
define('POLL_INTERVAL_SECONDS', 15);
define('POLL_TIMEOUT_SECONDS', 600);

foreach (['GLOO_CLIENT_ID' => CLIENT_ID, 'GLOO_CLIENT_SECRET' => CLIENT_SECRET, 'GLOO_PUBLISHER_ID' => PUBLISHER_ID] as $name => $value) {
    if ($value === '') {
        fwrite(STDERR, "Error: {$name} must be set. Copy .env.example to .env and fill in your values.\n");
        exit(1);
    }
}

/**
 * Manages OAuth2 client-credentials token lifecycle.
 */
class TokenManager
{
    private ?array $tokenInfo = null;

    public function getToken(): string
    {
        if ($this->isExpired()) {
            $ch = curl_init(TOKEN_URL);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_USERPWD => CLIENT_ID . ':' . CLIENT_SECRET,
                CURLOPT_POSTFIELDS => http_build_query([
                    'grant_type' => 'client_credentials',
                    'scope' => 'api/access',
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_TIMEOUT => 30,
            ]);
            $body = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($body === false || $status >= 400) {
                throw new RuntimeException("Token request failed: HTTP {$status} {$body}");
            }

            $this->tokenInfo = json_decode((string) $body, true);
            $this->tokenInfo['expires_at'] = time() + (int) $this->tokenInfo['expires_in'];
        }
        return $this->tokenInfo['access_token'];
    }

    private function isExpired(): bool
    {
        return $this->tokenInfo === null || time() > ($this->tokenInfo['expires_at'] - 60);
    }
}

/**
 * Uploads content, sets metadata, and verifies indexing.
 */
class PipelineSetup
{
    public function __construct(private readonly TokenManager $tokenManager)
    {
    }

    /**
     * Upload a single file; return its item ID.
     *
     * A stable producer_id makes re-runs idempotent: if the same content
     * was already uploaded, the API reports it as a duplicate and we
     * reuse the existing item instead of creating a new one.
     */
    public function uploadFile(string $filePath): string
    {
        $url = UPLOAD_URL . '?producer_id=' . urlencode(PRODUCER_ID);
        $result = $this->request('POST', $url, [
            CURLOPT_POSTFIELDS => [
                'publisher_id' => PUBLISHER_ID,
                'files' => new CURLFile($filePath, 'text/markdown', basename($filePath)),
            ],
            CURLOPT_TIMEOUT => 120,
        ]);

        if (!empty($result['ingesting'])) {
            echo "  Queued for ingestion: {$result['ingesting'][0]}\n";
            return $result['ingesting'][0];
        }
        if (!empty($result['duplicates'])) {
            echo "  Already ingested (duplicate detected), reusing item: {$result['duplicates'][0]}\n";
            return $result['duplicates'][0];
        }
        throw new RuntimeException('Unexpected upload response: ' . json_encode($result));
    }

    /**
     * Attach descriptive metadata to the uploaded item.
     */
    public function setMetadata(string $itemId): void
    {
        $metadata = [
            'publisher_id' => PUBLISHER_ID,
            'item_id' => $itemId,
            'item_title' => 'Building Stronger Communities Through Service',
            'item_summary' => 'Practical guidance for starting and sustaining community service efforts.',
            'author' => ['Gloo AI Docs Team'],
            'item_tags' => ['community', 'service', 'rag-pipeline-series'],
        ];
        $this->request('PATCH', ITEM_METADATA_URL, [
            CURLOPT_POSTFIELDS => json_encode($metadata),
        ], ['Content-Type: application/json']);

        $tagCount = count($metadata['item_tags']);
        echo "  Metadata set: title, summary, author, {$tagCount} tags\n";
    }

    /**
     * Fetch current item metadata, including ingestion status.
     */
    public function getItem(string $itemId): array
    {
        return $this->request('GET', ITEM_STATUS_URL . '/' . $itemId);
    }

    /**
     * Poll item status until indexing completes or the timeout elapses.
     */
    public function waitUntilIndexed(string $itemId): array
    {
        $deadline = time() + POLL_TIMEOUT_SECONDS;
        $lastStatus = null;

        while (time() < $deadline) {
            $item = $this->getItem($itemId);
            $status = $item['status'] ?? 'unknown';

            if ($status !== $lastStatus) {
                echo "  Status: {$status}\n";
                $lastStatus = $status;
            }

            // Terminal states (observed: CHUNKING while processing, COMPLETED when done).
            if (strtoupper($status) === 'COMPLETED') {
                return $item;
            }
            if (in_array(strtoupper($status), ['FAILED', 'ERROR'], true)) {
                throw new RuntimeException("Ingestion failed with status: {$status}");
            }

            sleep(POLL_INTERVAL_SECONDS);
        }

        throw new RuntimeException(
            "Item {$itemId} not indexed within " . POLL_TIMEOUT_SECONDS . "s (last status: {$lastStatus})"
        );
    }

    /**
     * Execute an authenticated API request and decode the JSON response.
     */
    private function request(string $method, string $url, array $options = [], array $extraHeaders = []): array
    {
        $headers = array_merge(
            ['Authorization: Bearer ' . $this->tokenManager->getToken()],
            $extraHeaders
        );

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
        ] + $options);

        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $status >= 400) {
            throw new RuntimeException("{$method} {$url} failed: HTTP {$status} {$body}");
        }
        return json_decode((string) $body, true) ?? [];
    }
}

try {
    $pipeline = new PipelineSetup(new TokenManager());

    echo "Step 1: Uploading sample content...\n";
    $itemId = $pipeline->uploadFile(SAMPLE_FILE);

    echo "\nStep 2: Setting item metadata...\n";
    $pipeline->setMetadata($itemId);

    echo "\nStep 3: Verifying indexing (polling)...\n";
    $item = $pipeline->waitUntilIndexed($itemId);

    echo "\nPipeline content is indexed and ready.\n";
    echo "  Item ID:  {$item['item_id']}\n";
    echo "  Title:    {$item['item_title']}\n";
    echo '  Author:   ' . implode(', ', $item['author'] ?? []) . "\n";
    echo '  Tags:     ' . implode(', ', $item['item_tags'] ?? []) . "\n";
    echo "  Status:   {$item['status']}\n";
    echo "\nNext: query this content with the Search API, or ask questions about it\n";
    echo "with Grounded Completions (see the deep-dive recipes).\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
