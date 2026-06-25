<?php

declare(strict_types=1);

/**
 * Gloo AI RAG Pipeline - Part 3: Verification, Error Handling & Resilience (PHP)
 *
 * Builds a small resilient API client and demonstrates three production
 * concerns against the Gloo AI Data Engine:
 *
 *   1. Interpreting structured API error responses (status, code, message)
 *   2. Retrying transient failures with exponential backoff
 *   3. Verifying ingestion health, handling missing items gracefully
 *
 * There are no monitoring or health-check endpoints — resilience here is built
 * from the same item APIs used in Parts 1 and 2, plus disciplined error handling.
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
define('ITEMS_URL', API_ROOT . '/engine/v2/items');

define('SAMPLE_DIR', __DIR__ . '/../sample_files');

// Retry policy: only transient failures are retried. Client errors (400, 401,
// 403, 404, 422) are bugs in the request, not blips, so they fail fast.
const RETRYABLE_STATUSES = [500, 502, 503, 504];
const MAX_RETRIES = 4;
const BASE_DELAY_SECONDS = 1;

// Ingestion polling (asynchronous; ~6 minutes for a small file).
const POLL_INTERVAL_SECONDS = 15;
const POLL_TIMEOUT_SECONDS = 600;

function seedItems(): array
{
    return [
        ['strengthening-feedback-loops.md', 'rag-pipeline-part3-feedback-loops'],
        ['learning-from-incidents.md', 'rag-pipeline-part3-incident-reviews'],
    ];
}

function guidv4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

foreach (['GLOO_CLIENT_ID' => CLIENT_ID, 'GLOO_CLIENT_SECRET' => CLIENT_SECRET, 'GLOO_PUBLISHER_ID' => PUBLISHER_ID] as $name => $value) {
    if ($value === '') {
        fwrite(STDERR, "Error: {$name} must be set. Copy .env.example to .env and fill in your values.\n");
        exit(1);
    }
}

/**
 * A normalized API error: HTTP status (null for network failures), a
 * machine-readable code, and a human-readable message.
 */
class ApiError extends RuntimeException
{
    public function __construct(public readonly ?int $status, public readonly ?string $apiCode, string $message)
    {
        parent::__construct($message);
    }

    public function isRetryable(): bool
    {
        // Network failures (status null) and transient server statuses are retryable.
        return $this->status === null || in_array($this->status, RETRYABLE_STATUSES, true);
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
                CURLOPT_POSTFIELDS => http_build_query(['grant_type' => 'client_credentials', 'scope' => 'api/access']),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_TIMEOUT => 30,
            ]);
            $body = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($body === false || $status >= 400) {
                throw new RuntimeException("Token request failed: HTTP {$status}");
            }
            $this->tokenInfo = json_decode((string) $body, true);
            $this->tokenInfo['expires_at'] = time() + (int) $this->tokenInfo['expires_in'];
        }
        return $this->tokenInfo['access_token'];
    }

    /** Drop the cached token so the next call fetches a fresh one. */
    public function forceRefresh(): void
    {
        $this->tokenInfo = null;
    }

    private function isExpired(): bool
    {
        return $this->tokenInfo === null || time() > ($this->tokenInfo['expires_at'] - 60);
    }
}

/**
 * A thin HTTP client with structured error parsing, retry-with-backoff,
 * and one-shot token refresh on 401.
 */
class ResilientClient
{
    private const REASONS = [
        400 => 'Bad Request', 401 => 'Unauthorized', 403 => 'Forbidden', 404 => 'Not Found',
        422 => 'Unprocessable Entity', 500 => 'Internal Server Error', 502 => 'Bad Gateway',
        503 => 'Service Unavailable', 504 => 'Gateway Timeout',
    ];

    public function __construct(private readonly TokenManager $tokenManager)
    {
    }

    /**
     * Extract [code, message] from the API's error shapes:
     * {"detail": {"code", "message"}}, {"detail": "..."}, {"error", "message"}.
     *
     * @return array{0:?string,1:string}
     */
    private function parseError(int $status, string $body): array
    {
        $reason = self::REASONS[$status] ?? "HTTP {$status}";
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            $detail = $decoded['detail'] ?? null;
            if (is_array($detail)) {
                return [$detail['code'] ?? null, ($detail['message'] ?? '') ?: $reason];
            }
            if (is_string($detail)) {
                return [null, $detail];
            }
            if (array_key_exists('error', $decoded) || array_key_exists('message', $decoded)) {
                return [$decoded['error'] ?? null, ($decoded['message'] ?? '') ?: $reason];
            }
        }
        return [null, substr($body, 0, 200) ?: $reason];
    }

    private function backoff(int $attempt, ?int $status, ?string $code): void
    {
        $delay = BASE_DELAY_SECONDS * (2 ** $attempt);
        $label = $status ?? 'network error';
        printf("    Attempt %d failed (%s: %s); retrying in %ds\n", $attempt + 1, $label, $code, $delay);
        sleep($delay);
    }

    /**
     * Low-level request; returns [int status, string body, int curlErrno].
     *
     * @return array{0:int,1:string,2:int}
     */
    private function httpRaw(string $method, string $url, array $headers, array $extraOpts = []): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
        ] + $extraOpts);
        $body = curl_exec($ch);
        $errno = curl_errno($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [(int) $status, $body === false ? '' : (string) $body, $errno];
    }

    /**
     * Send a request, retrying transient failures and refreshing the token once
     * on 401. Throws ApiError on non-retryable failures or exhausted retries.
     */
    public function request(string $method, string $url, array $opts = []): mixed
    {
        $json = $opts['json'] ?? null;
        $params = $opts['params'] ?? null;
        $token = $opts['token'] ?? null;
        $allowRefresh = $opts['allowRefresh'] ?? true;

        $target = $params ? $url . '?' . http_build_query($params) : $url;
        $refreshed = false;

        for ($attempt = 0; $attempt <= MAX_RETRIES; $attempt++) {
            $bearer = $token ?? $this->tokenManager->getToken();
            $headers = ["Authorization: Bearer {$bearer}", 'Content-Type: application/json'];
            $extra = $json !== null ? [CURLOPT_POSTFIELDS => json_encode($json)] : [];

            [$status, $body, $errno] = $this->httpRaw($method, $target, $headers, $extra);

            if ($errno !== 0) {
                if ($attempt < MAX_RETRIES) {
                    $this->backoff($attempt, null, 'connection');
                    continue;
                }
                throw new ApiError(null, 'network_error', "curl error {$errno}");
            }

            if ($status === 401 && $allowRefresh && !$refreshed) {
                $refreshed = true;
                $this->tokenManager->forceRefresh();
                continue; // retry immediately with a fresh token
            }

            if (in_array($status, RETRYABLE_STATUSES, true) && $attempt < MAX_RETRIES) {
                [$code] = $this->parseError($status, $body);
                $this->backoff($attempt, $status, $code);
                continue;
            }

            if ($status >= 400) {
                [$code, $message] = $this->parseError($status, $body);
                throw new ApiError($status, $code, $message);
            }

            return json_decode($body, true);
        }
        throw new ApiError(null, 'retries_exhausted', 'Exhausted retries');
    }

    /** Run an operation, retrying it on retryable ApiError with backoff. */
    public function callWithRetry(callable $operation, string $label = 'operation'): mixed
    {
        for ($attempt = 0; $attempt <= MAX_RETRIES; $attempt++) {
            try {
                return $operation();
            } catch (ApiError $e) {
                if ($e->isRetryable() && $attempt < MAX_RETRIES) {
                    $this->backoff($attempt, $e->status, $e->apiCode);
                    continue;
                }
                throw $e;
            }
        }
        throw new ApiError(null, 'retries_exhausted', "Exhausted retries for {$label}");
    }

    /** Upload a single file, retrying transient failures (5xx or network blips). */
    public function uploadFile(string $filePath, string $producerId): string
    {
        $operation = function () use ($filePath, $producerId) {
            $url = UPLOAD_URL . '?producer_id=' . urlencode($producerId);
            $headers = ['Authorization: Bearer ' . $this->tokenManager->getToken()];
            [$status, $body, $errno] = $this->httpRaw('POST', $url, $headers, [
                CURLOPT_POSTFIELDS => [
                    'publisher_id' => PUBLISHER_ID,
                    'files' => new CURLFile($filePath, 'text/markdown', basename($filePath)),
                ],
                CURLOPT_TIMEOUT => 120,
            ]);
            if ($errno !== 0) {
                throw new ApiError(null, 'network_error', "curl error {$errno}");
            }
            if ($status >= 400) {
                [$code, $message] = $this->parseError($status, $body);
                throw new ApiError($status, $code, $message);
            }
            return json_decode($body, true);
        };
        $result = $this->callWithRetry($operation, 'upload');
        return ($result['ingesting'] ?? []) ? $result['ingesting'][0] : $result['duplicates'][0];
    }

    public function getItem(string $itemId): array
    {
        return $this->request('GET', ITEMS_URL . '/' . $itemId);
    }

    public function deleteItems(array $itemIds): array
    {
        return $this->request('DELETE', ITEMS_URL, ['json' => ['item_ids' => $itemIds]]);
    }

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
                    throw new ApiError(null, 'ingestion_failed', "{$itemId}: {$status}");
                }
            }
            if (count($pending) > 0) {
                echo '  Waiting for ' . count($pending) . " item(s) to finish indexing...\n";
                sleep(POLL_INTERVAL_SECONDS);
            }
        }
        if (count($pending) > 0) {
            throw new ApiError(null, 'ingestion_timeout', 'Not indexed within timeout');
        }
    }
}

/** Trigger representative error responses and show the parsed result. */
function demoErrorHandling(ResilientClient $client): void
{
    $cases = [
        ['Missing item (random UUID)', 'GET', ITEMS_URL . '/' . guidv4(), []],
        ['Malformed item ID', 'GET', ITEMS_URL . '/not-a-valid-uuid', []],
        ['Rejected bearer token', 'GET', ITEMS_URL . '/' . guidv4(), ['token' => 'invalid-token', 'allowRefresh' => false]],
    ];
    foreach ($cases as [$label, $method, $url, $opts]) {
        try {
            $client->request($method, $url, $opts);
            echo "  {$label}: unexpectedly succeeded\n";
        } catch (ApiError $e) {
            echo "  {$label}: status={$e->status} code='{$e->apiCode}' message='{$e->getMessage()}'\n";
        }
    }
}

/**
 * Show the backoff policy recovering from transient failures.
 * Simulates a service returning 503 twice before succeeding — the same path a
 * real 5xx or network error would take.
 */
function demoRetry(ResilientClient $client): void
{
    $calls = 0;
    $flaky = function () use (&$calls) {
        $calls++;
        if ($calls < 3) {
            throw new ApiError(503, 'service_unavailable', 'Service temporarily unavailable');
        }
        return ['ok' => true];
    };
    $client->callWithRetry($flaky, 'sample operation');
    echo "  Succeeded after {$calls} attempts\n";
}

/**
 * Upload a batch, confirm each item indexed, and report a health summary
 * that also surfaces a missing item.
 */
function demoHealthCheck(ResilientClient $client): void
{
    echo "  Uploading and indexing a batch...\n";
    $itemIds = [];
    foreach (seedItems() as [$filename, $producerId]) {
        $itemIds[] = $client->uploadFile(SAMPLE_DIR . '/' . $filename, $producerId);
    }
    $client->waitUntilIndexed($itemIds);

    // Include an ID that doesn't exist to show graceful handling of 404s.
    $toCheck = array_merge($itemIds, [guidv4()]);
    $summary = ['completed' => 0, 'pending' => 0, 'failed' => 0, 'not_found' => 0];
    foreach ($toCheck as $itemId) {
        try {
            $status = strtoupper($client->getItem($itemId)['status'] ?? 'UNKNOWN');
            if ($status === 'COMPLETED') {
                $summary['completed']++;
            } elseif (in_array($status, ['FAILED', 'ERROR'], true)) {
                $summary['failed']++;
            } else {
                $summary['pending']++;
            }
        } catch (ApiError $e) {
            if ($e->status === 404) {
                $summary['not_found']++;
            } else {
                throw $e;
            }
        }
    }
    echo "  Health: {$summary['completed']} completed, {$summary['pending']} pending, "
        . "{$summary['failed']} failed, {$summary['not_found']} not found\n";

    $client->deleteItems($itemIds);
    echo '  Cleaned up ' . count($itemIds) . " item(s)\n";
}

try {
    $client = new ResilientClient(new TokenManager());

    echo "Step 1: Resilient client ready (token refresh, error parsing, retry/backoff).\n";

    echo "\nStep 2: Interpreting API error responses...\n";
    demoErrorHandling($client);

    echo "\nStep 3: Retrying transient failures with backoff...\n";
    demoRetry($client);

    echo "\nStep 4: Verifying ingestion health...\n";
    demoHealthCheck($client);

    echo "\nDone. The resilient client handled errors, retries, and verification end to end.\n";
} catch (ApiError $e) {
    fwrite(STDERR, 'API error: ' . $e->getMessage() . "\n");
    exit(1);
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
