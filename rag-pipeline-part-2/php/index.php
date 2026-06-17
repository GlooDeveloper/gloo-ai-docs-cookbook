<?php

declare(strict_types=1);

/**
 * Gloo AI RAG Pipeline - Part 2: Content Lifecycle (PHP)
 *
 * Seeds a small set of items, then demonstrates the content lifecycle:
 * update a single item, bulk-edit several items, verify the changes, and
 * delete the items (cleanup).
 *
 * Every mutation is scoped to the exact item IDs this recipe created —
 * captured from the upload responses — so it never touches other content
 * in the publisher.
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
define('ITEM_URL', API_ROOT . '/engine/v2/item');    // single-item update (PATCH)
define('ITEMS_URL', API_ROOT . '/engine/v2/items');  // bulk patch (PATCH), delete (DELETE)

define('SAMPLE_DIR', __DIR__ . '/../sample_files');

// Ingestion is asynchronous and typically takes several minutes.
define('POLL_INTERVAL_SECONDS', 15);
define('POLL_TIMEOUT_SECONDS', 600);

// Edits succeed immediately, but the read path is eventually consistent:
// a freshly patched item can take a few seconds to reflect the change on a
// subsequent GET. Verification re-fetches until the change is visible.
define('VERIFY_ATTEMPTS', 20);
define('VERIFY_INTERVAL_SECONDS', 3);

// The items this recipe manages. Producer IDs are stable identifiers you assign;
// here they share a prefix unique to this recipe.
function seedItems(): array
{
    return [
        [
            'file' => 'volunteer-onboarding.md',
            'producer_id' => 'rag-pipeline-part2-volunteer-onboarding',
            'item_title' => 'Onboarding New Volunteers',
            'item_summary' => 'How a warm, organized welcome turns newcomers into committed volunteers.',
            'author' => ['Gloo AI Docs Team'],
            'item_tags' => ['volunteers', 'rag-pipeline-series'],
        ],
        [
            'file' => 'measuring-community-impact.md',
            'producer_id' => 'rag-pipeline-part2-measuring-impact',
            'item_title' => 'Measuring Community Impact',
            'item_summary' => 'Why measuring outcomes, not activity, sustains community programs.',
            'author' => ['Gloo AI Docs Team'],
            'item_tags' => ['measurement', 'rag-pipeline-series'],
        ],
        [
            'file' => 'sustaining-engagement.md',
            'producer_id' => 'rag-pipeline-part2-sustaining-engagement',
            'item_title' => 'Sustaining Long-Term Engagement',
            'item_summary' => 'Practices that keep volunteers engaged through the long haul.',
            'author' => ['Gloo AI Docs Team'],
            'item_tags' => ['engagement', 'rag-pipeline-series'],
        ],
    ];
}

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
 * Seeds content and performs scoped lifecycle operations on it.
 */
class ContentLifecycle
{
    public function __construct(private readonly TokenManager $tokenManager)
    {
    }

    /**
     * Upload a single file under a stable producer ID; return its item ID.
     * The upload response is the authoritative source of the item ID — keep it.
     */
    public function uploadFile(string $filePath, string $producerId): string
    {
        $url = UPLOAD_URL . '?producer_id=' . urlencode($producerId);
        [, $result] = $this->send('POST', $url, [
            CURLOPT_POSTFIELDS => [
                'publisher_id' => PUBLISHER_ID,
                'files' => new CURLFile($filePath, 'text/markdown', basename($filePath)),
            ],
            CURLOPT_TIMEOUT => 120,
        ]);
        $itemId = ($result['ingesting'] ?? []) ? $result['ingesting'][0] : ($result['duplicates'][0] ?? null);
        if ($itemId === null) {
            throw new RuntimeException('Unexpected upload response: ' . json_encode($result));
        }
        return $itemId;
    }

    /** Set metadata on a single item via PATCH /engine/v2/item. */
    public function setMetadata(string $itemId, array $fields): void
    {
        $payload = array_merge(['publisher_id' => PUBLISHER_ID, 'item_id' => $itemId], $fields);
        $this->send('PATCH', ITEM_URL, [
            CURLOPT_POSTFIELDS => json_encode($payload),
        ], ['Content-Type: application/json']);
    }

    /** Fetch current item metadata, including ingestion status. */
    public function getItem(string $itemId): array
    {
        [, $result] = $this->send('GET', ITEMS_URL . '/' . $itemId);
        return $result;
    }

    /** Return true while the item can still be fetched (false once deleted). */
    public function itemExists(string $itemId): bool
    {
        [$status] = $this->send('GET', ITEMS_URL . '/' . $itemId, [], [], allowNotFound: true);
        return $status !== 404;
    }

    /** Poll until every item reaches COMPLETED or the timeout elapses. */
    public function waitUntilIndexed(array $itemIds): void
    {
        $deadline = time() + POLL_TIMEOUT_SECONDS;
        $pending = array_flip($itemIds);

        while (count($pending) > 0 && time() < $deadline) {
            foreach (array_keys($pending) as $itemId) {
                $status = strtoupper($this->getItem($itemId)['status'] ?? 'UNKNOWN');
                if ($status === 'COMPLETED') {
                    unset($pending[$itemId]);
                } elseif (in_array($status, ['FAILED', 'ERROR'], true)) {
                    throw new RuntimeException("Ingestion failed for {$itemId}: {$status}");
                }
            }
            if (count($pending) > 0) {
                echo '  Waiting for ' . count($pending) . " item(s) to finish indexing...\n";
                sleep(POLL_INTERVAL_SECONDS);
            }
        }
        if (count($pending) > 0) {
            throw new RuntimeException('Items not indexed within timeout: ' . implode(', ', array_keys($pending)));
        }
    }

    /** Apply patch operations to a specific set of items (scoped by item_ids). */
    public function bulkPatch(array $itemIds, array $ops): array
    {
        $url = ITEMS_URL . '?publisher_id=' . urlencode(PUBLISHER_ID);
        [, $result] = $this->send('PATCH', $url, [
            CURLOPT_POSTFIELDS => json_encode(['filter' => ['item_ids' => $itemIds], 'ops' => $ops]),
            CURLOPT_TIMEOUT => 60,
        ], ['Content-Type: application/json']);
        return $result;
    }

    /** Delete a specific set of items by ID. */
    public function deleteItems(array $itemIds): array
    {
        [, $result] = $this->send('DELETE', ITEMS_URL, [
            CURLOPT_POSTFIELDS => json_encode(['item_ids' => $itemIds]),
            CURLOPT_TIMEOUT => 60,
        ], ['Content-Type: application/json']);
        return $result;
    }

    /** Re-fetch an item until the given tag is visible (read-after-write retry). */
    public function getItemWithTag(string $itemId, string $tag): array
    {
        $item = $this->getItem($itemId);
        for ($attempt = 0; $attempt < VERIFY_ATTEMPTS; $attempt++) {
            if (in_array($tag, $item['item_tags'] ?? [], true)) {
                return $item;
            }
            sleep(VERIFY_INTERVAL_SECONDS);
            $item = $this->getItem($itemId);
        }
        return $item;
    }

    /** Re-check until the item is gone (GET returns 404), or attempts run out. */
    public function waitUntilDeleted(string $itemId): bool
    {
        for ($attempt = 0; $attempt < VERIFY_ATTEMPTS; $attempt++) {
            if (!$this->itemExists($itemId)) {
                return true;
            }
            sleep(VERIFY_INTERVAL_SECONDS);
        }
        return false;
    }

    /**
     * Execute an authenticated request; return [status, decodedBody].
     *
     * @return array{0:int,1:array}
     */
    private function send(string $method, string $url, array $options = [], array $extraHeaders = [], bool $allowNotFound = false): array
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

        if ($body === false) {
            throw new RuntimeException("{$method} {$url} failed: no response");
        }
        if ($status >= 400 && !($allowNotFound && $status === 404)) {
            throw new RuntimeException("{$method} {$url} failed: HTTP {$status} {$body}");
        }
        return [$status, json_decode((string) $body, true) ?? []];
    }
}

try {
    $lifecycle = new ContentLifecycle(new TokenManager());
    $seeds = seedItems();

    echo "Step 1: Seeding sample content...\n";
    // Capture each item's ID from its upload response — the authoritative handle
    // we scope every later operation to.
    $mapping = [];
    foreach ($seeds as $item) {
        $itemId = $lifecycle->uploadFile(SAMPLE_DIR . '/' . $item['file'], $item['producer_id']);
        $lifecycle->setMetadata($itemId, [
            'item_title' => $item['item_title'],
            'item_summary' => $item['item_summary'],
            'author' => $item['author'],
            'item_tags' => $item['item_tags'],
        ]);
        $mapping[$item['producer_id']] = $itemId;
        echo "  Uploaded {$item['producer_id']} -> {$itemId}\n";
    }
    $itemIds = array_values($mapping);
    echo "  Waiting for ingestion to complete (this can take a few minutes)...\n";
    $lifecycle->waitUntilIndexed($itemIds);
    echo "  All seed items indexed.\n";

    echo "\nStep 2: Updating a single item...\n";
    $targetProducer = 'rag-pipeline-part2-volunteer-onboarding';
    $lifecycle->setMetadata($mapping[$targetProducer], [
        'item_title' => 'Onboarding New Volunteers: A First-Day Playbook',
        'item_summary' => 'A practical first-day checklist for welcoming and retaining new volunteers.',
    ]);
    echo "  Updated title and summary for {$targetProducer}\n";

    echo "\nStep 3: Bulk-editing all seeded items...\n";
    $reviewTag = 'reviewed-q2-2026';
    $result = $lifecycle->bulkPatch($itemIds, [
        ['op' => 'append', 'field' => 'item_tags', 'value' => [$reviewTag]],
        ['op' => 'replace', 'field' => 'author', 'value' => ['Community Programs Team']],
    ]);
    echo "  Matched {$result['total_matched']}, patched {$result['total_patched']}, "
        . "failed {$result['total_failed']}\n";

    echo "\nStep 4: Verifying changes...\n";
    foreach ($mapping as $itemId) {
        $item = $lifecycle->getItemWithTag($itemId, $reviewTag);
        echo "  {$item['item_title']}\n";
        echo '    author: ' . implode(', ', $item['author'] ?? []) . "\n";
        echo '    tags:   ' . implode(', ', $item['item_tags'] ?? []) . "\n";
    }

    echo "\nStep 5: Deleting items (cleanup)...\n";
    $deletion = $lifecycle->deleteItems($itemIds);
    echo "  Requested {$deletion['total_requested']}, deleted {$deletion['total_deleted']}, "
        . "failed {$deletion['total_failed']}\n";
    $allGone = true;
    foreach ($itemIds as $itemId) {
        $allGone = $lifecycle->waitUntilDeleted($itemId) && $allGone;
    }
    echo '  All items confirmed deleted: ' . ($allGone ? 'true' : 'false') . "\n";
    echo "\nLifecycle complete. The publisher is back to its pre-recipe state.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
