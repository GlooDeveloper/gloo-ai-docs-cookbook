<?php
/**
 * Gloo AI Upload Files - PHP Example
 *
 * This script demonstrates how to use the Gloo AI Data Engine Files API
 * to upload files directly for processing and AI-powered search.
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// --- Configuration ---
$CLIENT_ID = $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID';
$CLIENT_SECRET = $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET';
$PUBLISHER_ID = $_ENV['GLOO_PUBLISHER_ID'] ?? 'your-publisher-id';

$TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
$UPLOAD_URL = 'https://platform.ai.gloo.com/ingestion/v2/files';
$METADATA_URL = 'https://platform.ai.gloo.com/engine/v2/item';

// Supported file extensions
$SUPPORTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx'];

// Validate credentials
if ($CLIENT_ID === 'YOUR_CLIENT_ID' || $CLIENT_SECRET === 'YOUR_CLIENT_SECRET' ||
    empty($CLIENT_ID) || empty($CLIENT_SECRET)) {
    fwrite(STDERR, "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set\n");
    echo "Create a .env file with your credentials:\n";
    echo "GLOO_CLIENT_ID=your_client_id_here\n";
    echo "GLOO_CLIENT_SECRET=your_client_secret_here\n";
    echo "GLOO_PUBLISHER_ID=your_publisher_id_here\n";
    exit(1);
}

// --- State Management ---
$tokenInfo = [];

/**
 * Get a new access token from the OAuth2 endpoint.
 */
function getAccessToken(): array {
    global $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL;

    $postData = 'grant_type=client_credentials&scope=api/access';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $TOKEN_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_USERPWD, $CLIENT_ID . ':' . $CLIENT_SECRET);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        throw new Exception('Failed to obtain access token: ' . curl_error($ch));
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception('Failed to obtain access token: HTTP ' . $httpCode);
    }

    $tokenData = json_decode($result, true);
    $tokenData['expires_at'] = time() + $tokenData['expires_in'];

    return $tokenData;
}

/**
 * Check if the current token is expired.
 */
function isTokenExpired(array $token): bool {
    if (empty($token) || !isset($token['expires_at'])) {
        return true;
    }
    return time() > ($token['expires_at'] - 60);
}

/**
 * Ensure we have a valid access token.
 */
function ensureValidToken(): string {
    global $tokenInfo;

    if (isTokenExpired($tokenInfo)) {
        echo "Token is expired or missing. Fetching a new one...\n";
        $tokenInfo = getAccessToken();
    }

    return $tokenInfo['access_token'];
}

/**
 * Check if a file extension is supported.
 */
function isSupportedFile(string $filePath): bool {
    global $SUPPORTED_EXTENSIONS;
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    return in_array('.' . $ext, $SUPPORTED_EXTENSIONS);
}

/**
 * Upload a single file to the Data Engine.
 */
function uploadSingleFile(string $filePath, ?string $producerId = null): array {
    global $UPLOAD_URL, $PUBLISHER_ID;

    if (!file_exists($filePath)) {
        throw new Exception("File not found: $filePath");
    }

    if (!isSupportedFile($filePath)) {
        throw new Exception("Unsupported file type: " . pathinfo($filePath, PATHINFO_EXTENSION));
    }

    $token = ensureValidToken();

    $url = $UPLOAD_URL;
    if ($producerId) {
        $url .= '?' . http_build_query(['producer_id' => $producerId]);
    }

    $postFields = [
        'files' => new CURLFile(
            realpath($filePath),
            mime_content_type($filePath) ?: 'application/octet-stream',
            basename($filePath)
        ),
        'publisher_id' => $PUBLISHER_ID
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        throw new Exception('Upload failed: ' . curl_error($ch));
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 300) {
        throw new Exception("Upload failed: HTTP $httpCode - $result");
    }

    return json_decode($result, true);
}

/**
 * Update metadata for an uploaded item.
 */
function updateMetadata(?string $itemId, ?string $producerId, array $metadata): array {
    global $METADATA_URL, $PUBLISHER_ID;

    if (!$itemId && !$producerId) {
        throw new Exception('Either itemId or producerId must be provided');
    }

    $token = ensureValidToken();

    $data = ['publisher_id' => $PUBLISHER_ID];
    if ($itemId) {
        $data['item_id'] = $itemId;
    }
    if ($producerId) {
        $data['producer_id'] = $producerId;
    }
    $data = array_merge($data, $metadata);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $METADATA_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        throw new Exception('Metadata update failed: ' . curl_error($ch));
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 300) {
        throw new Exception("Metadata update failed: HTTP $httpCode - $result");
    }

    return json_decode($result, true);
}

/**
 * Upload a single file command handler.
 */
function cmdUploadSingle(string $filePath, ?string $producerId = null): void {
    try {
        echo "Uploading: $filePath\n";
        if ($producerId) {
            echo "  Producer ID: $producerId\n";
        }

        $result = uploadSingleFile($filePath, $producerId);

        echo "Upload successful!\n";
        echo "  Message: " . ($result['message'] ?? 'N/A') . "\n";

        if (!empty($result['ingesting'])) {
            echo "  Ingesting: " . count($result['ingesting']) . " file(s)\n";
            foreach ($result['ingesting'] as $id) {
                echo "    - $id\n";
            }
        }

        if (!empty($result['duplicates'])) {
            echo "  Duplicates: " . count($result['duplicates']) . " file(s)\n";
            foreach ($result['duplicates'] as $id) {
                echo "    - $id\n";
            }
        }
    } catch (Exception $e) {
        fwrite(STDERR, "Upload failed: " . $e->getMessage() . "\n");
        exit(1);
    }
}

/**
 * Batch upload command handler.
 */
function cmdUploadBatch(string $directoryPath): void {
    global $SUPPORTED_EXTENSIONS;

    if (!is_dir($directoryPath)) {
        fwrite(STDERR, "Directory does not exist: $directoryPath\n");
        exit(1);
    }

    // Find all supported files
    $files = scandir($directoryPath);
    $supportedFiles = array_filter($files, function($file) {
        return isSupportedFile($file) && !in_array($file, ['.', '..']);
    });

    if (empty($supportedFiles)) {
        echo "No supported files found in: $directoryPath\n";
        return;
    }

    echo "Found " . count($supportedFiles) . " file(s) to upload\n";

    $processed = 0;
    $failed = 0;

    foreach ($supportedFiles as $filename) {
        $filePath = rtrim($directoryPath, '/') . '/' . $filename;
        try {
            echo "\nUploading: $filename\n";
            $result = uploadSingleFile($filePath);

            if (!empty($result['ingesting'])) {
                echo "  Ingesting: " . $result['ingesting'][0] . "\n";
                $processed++;
            } elseif (!empty($result['duplicates'])) {
                echo "  Duplicate detected: " . $result['duplicates'][0] . "\n";
                $processed++;
            } else {
                echo "  Result: " . ($result['message'] ?? 'Unknown') . "\n";
                $processed++;
            }
        } catch (Exception $e) {
            fwrite(STDERR, "  Failed: " . $e->getMessage() . "\n");
            $failed++;
        }

        // Rate limiting
        sleep(1);
    }

    echo "\nBatch upload complete:\n";
    echo "  Processed: $processed file(s)\n";
    echo "  Failed: $failed file(s)\n";
}

/**
 * Upload with metadata command handler.
 */
function cmdUploadWithMetadata(string $filePath, array $metadata): void {
    try {
        $producerId = 'upload-' . time();
        echo "Uploading: $filePath\n";
        echo "  Producer ID: $producerId\n";

        $result = uploadSingleFile($filePath, $producerId);

        if (!empty($result['ingesting'])) {
            $itemId = $result['ingesting'][0];
            echo "  Item ID: $itemId\n";

            if (!empty($metadata)) {
                echo "Updating metadata...\n";
                $metaResult = updateMetadata($itemId, null, $metadata);
                echo "  Metadata updated: " . ($metaResult['message'] ?? 'Success') . "\n";
            }
        } else {
            echo "  Result: " . ($result['message'] ?? 'Unknown') . "\n";
        }
    } catch (Exception $e) {
        fwrite(STDERR, "Operation failed: " . $e->getMessage() . "\n");
        exit(1);
    }
}

/**
 * Print usage information.
 */
function printUsage(): void {
    echo "Usage:\n";
    echo "  php index.php single <file_path> [producer_id]  # Upload single file\n";
    echo "  php index.php batch <directory>                  # Upload all files in directory\n";
    echo "  php index.php meta <file_path> --title <title>   # Upload with metadata\n";
    echo "\n";
    echo "Examples:\n";
    echo "  php index.php single ../sample_files/developer_happiness.txt\n";
    echo "  php index.php single ../sample_files/developer_happiness.txt my-doc-001\n";
    echo "  php index.php batch ../sample_files\n";
    echo "  php index.php meta ../sample_files/developer_happiness.txt --title \"Developer Happiness\"\n";
}

/**
 * Parse metadata arguments from command line.
 */
function parseMetadataArgs(array $args): array {
    $metadata = [];
    for ($i = 0; $i < count($args); $i++) {
        if ($args[$i] === '--title' && isset($args[$i + 1])) {
            $metadata['item_title'] = $args[$i + 1];
            $i++;
        } elseif ($args[$i] === '--author' && isset($args[$i + 1])) {
            $metadata['author'] = [$args[$i + 1]];
            $i++;
        } elseif ($args[$i] === '--tags' && isset($args[$i + 1])) {
            $metadata['item_tags'] = explode(',', $args[$i + 1]);
            $i++;
        }
    }
    return $metadata;
}

// --- Main Execution ---
if ($argc < 2) {
    printUsage();
    exit(1);
}

$command = strtolower($argv[1]);

try {
    switch ($command) {
        case 'single':
            if (!isset($argv[2])) {
                fwrite(STDERR, "Error: Please specify a file to upload\n");
                printUsage();
                exit(1);
            }
            cmdUploadSingle($argv[2], $argv[3] ?? null);
            break;

        case 'batch':
            if (!isset($argv[2])) {
                fwrite(STDERR, "Error: Please specify a directory\n");
                printUsage();
                exit(1);
            }
            cmdUploadBatch($argv[2]);
            break;

        case 'meta':
            if (!isset($argv[2])) {
                fwrite(STDERR, "Error: Please specify a file to upload\n");
                printUsage();
                exit(1);
            }
            $metadata = parseMetadataArgs(array_slice($argv, 3));
            cmdUploadWithMetadata($argv[2], $metadata);
            break;

        default:
            fwrite(STDERR, "Error: Invalid command '$command'\n");
            printUsage();
            exit(1);
    }
} catch (Exception $e) {
    fwrite(STDERR, "An error occurred: " . $e->getMessage() . "\n");
    exit(1);
}
