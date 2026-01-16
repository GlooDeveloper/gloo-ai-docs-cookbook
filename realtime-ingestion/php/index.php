<?php
/**
 * Gloo AI Realtime Content Ingestion - PHP Example
 *
 * This script demonstrates how to use the Gloo AI Realtime Ingestion API
 * to automatically upload content and make it available for search and AI interaction.
 */

require_once "vendor/autoload.php";

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Exception\GuzzleException;

// Load environment variables from .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

/**
 * Configuration constants
 */
class Config
{
    public const CLIENT_ID = "CLIENT_ID";
    public const CLIENT_SECRET = "CLIENT_SECRET";
    public const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    public const API_URL = "https://platform.ai.gloo.com/ingestion/v1/real_time_upload";
    public const PUBLISHER_ID = "your-publisher-id"; // Replace with your publisher ID
    public const SUPPORTED_EXTENSIONS = [".txt", ".md"];
    public const RATE_LIMIT_DELAY = 1; // seconds
}

/**
 * Token management class for OAuth2 authentication
 */
class TokenManager
{
    private array $tokenInfo = [];
    private Client $httpClient;
    private string $clientId;
    private string $clientSecret;

    public function __construct(
        Client $httpClient,
        string $clientId,
        string $clientSecret,
    ) {
        $this->httpClient = $httpClient;
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
    }

    /**
     * Get a new access token from the OAuth2 endpoint
     */
    public function getAccessToken(): array
    {
        try {
            $response = $this->httpClient->post(Config::TOKEN_URL, [
                "form_params" => [
                    "grant_type" => "client_credentials",
                    "scope" => "api/access",
                ],
                "auth" => [$this->clientId, $this->clientSecret],
                "timeout" => 30,
            ]);

            $tokenData = json_decode($response->getBody(), true);
            if (!$tokenData) {
                throw new Exception("Invalid token response format");
            }

            $tokenData["expires_at"] = time() + $tokenData["expires_in"];
            $this->tokenInfo = $tokenData;
            return $tokenData;
        } catch (RequestException $e) {
            throw new Exception(
                "Failed to get access token: " . $e->getMessage(),
            );
        }
    }

    /**
     * Check if the current token is expired or close to expiring
     */
    public function isTokenExpired(): bool
    {
        if (empty($this->tokenInfo) || !isset($this->tokenInfo["expires_at"])) {
            return true;
        }
        return time() > $this->tokenInfo["expires_at"] - 60; // 60 second buffer
    }

    /**
     * Get current token info, refreshing if necessary
     */
    public function getValidToken(): array
    {
        if ($this->isTokenExpired()) {
            echo "Token is expired or missing. Fetching a new one...\n";
            return $this->getAccessToken();
        }
        return $this->tokenInfo;
    }
}

/**
 * Content processing and upload management
 */
class ContentProcessor
{
    private TokenManager $tokenManager;
    private Client $httpClient;

    public function __construct(TokenManager $tokenManager, Client $httpClient)
    {
        $this->tokenManager = $tokenManager;
        $this->httpClient = $httpClient;
    }

    /**
     * Check if file extension is supported
     */
    public function isSupportedFile(string $filePath): bool
    {
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        return in_array("." . $extension, Config::SUPPORTED_EXTENSIONS);
    }

    /**
     * Extract and format title from filename
     */
    public function extractTitleFromFilename(string $filename): string
    {
        $title = pathinfo($filename, PATHINFO_FILENAME);
        $title = str_replace(["_", "-"], " ", $title);
        return ucwords($title);
    }

    /**
     * Create properly formatted content data for API upload
     */
    public function createContentData(string $content, string $title): array
    {
        return [
            "content" => $content,
            "publisherId" => Config::PUBLISHER_ID,
            "item_title" => $title,
            "author" => ["Automated Ingestion"],
            "publication_date" => date("Y-m-d"),
            "type" => "Article",
            "pub_type" => "technical",
            "item_tags" => ["automated", "ingestion"],
            "evergreen" => true,
            "drm" => ["aspen", "kallm"],
        ];
    }

    /**
     * Upload content to the Realtime API
     */
    public function uploadContent(array $contentData): array
    {
        $tokenInfo = $this->tokenManager->getValidToken();

        try {
            $response = $this->httpClient->post(Config::API_URL, [
                "json" => $contentData,
                "headers" => [
                    "Authorization" => "Bearer " . $tokenInfo["access_token"],
                    "Content-Type" => "application/json",
                ],
                "timeout" => 30,
            ]);

            $result = json_decode($response->getBody(), true);
            if (!$result) {
                throw new Exception("Invalid API response format");
            }

            return $result;
        } catch (RequestException $e) {
            throw new Exception("Upload failed: " . $e->getMessage());
        }
    }

    /**
     * Process a single file and upload its content
     */
    public function processFile(string $filePath): bool
    {
        try {
            // Validate file exists and is supported
            if (!file_exists($filePath)) {
                echo "❌ File does not exist: $filePath\n";
                return false;
            }

            if (!is_readable($filePath)) {
                echo "❌ File is not readable: $filePath\n";
                return false;
            }

            if (!$this->isSupportedFile($filePath)) {
                echo "❌ Unsupported file type: $filePath\n";
                return false;
            }

            // Read file content
            $content = file_get_contents($filePath);
            if ($content === false) {
                echo "❌ Failed to read file: $filePath\n";
                return false;
            }

            if (trim($content) === "") {
                echo "❌ File is empty: $filePath\n";
                return false;
            }

            // Extract metadata and create content data
            $filename = basename($filePath);
            $title = $this->extractTitleFromFilename($filename);
            $contentData = $this->createContentData($content, $title);

            // Upload content
            $result = $this->uploadContent($contentData);

            echo "✅ Successfully uploaded: $title\n";
            echo "   Response: " . $result["message"] . "\n";
            return true;
        } catch (Exception $e) {
            echo "❌ Failed to process $filePath: " . $e->getMessage() . "\n";
            return false;
        }
    }
}

/**
 * File system monitoring for directory watching
 */
class DirectoryWatcher
{
    private ContentProcessor $processor;
    private array $processedFiles = [];

    public function __construct(ContentProcessor $processor)
    {
        $this->processor = $processor;
    }

    /**
     * Start monitoring a directory for new files
     * Note: This is a simple polling implementation. For production use,
     * consider using inotify extension or a more sophisticated solution.
     */
    public function watch(string $directory): void
    {
        if (!is_dir($directory)) {
            if (!mkdir($directory, 0755, true)) {
                throw new Exception("Failed to create directory: $directory");
            }
            echo "Created watch directory: $directory\n";
        }

        echo "🔍 Monitoring directory: $directory\n";
        echo "   Supported file types: " .
            implode(", ", Config::SUPPORTED_EXTENSIONS) .
            "\n";
        echo "   Press Ctrl+C to stop\n";

        // Set up signal handler for graceful shutdown
        if (function_exists("pcntl_signal")) {
            pcntl_signal(SIGINT, function () {
                echo "\n👋 Stopping file monitor...\n";
                exit(0);
            });
        }

        while (true) {
            $this->scanForNewFiles($directory);
            sleep(2); // Check every 2 seconds

            // Process signals if available
            if (function_exists("pcntl_signal_dispatch")) {
                pcntl_signal_dispatch();
            }
        }
    }

    /**
     * Scan directory for new or modified files
     */
    private function scanForNewFiles(string $directory): void
    {
        $pattern =
            $directory .
            "/*{" .
            implode(",", Config::SUPPORTED_EXTENSIONS) .
            "}";
        $files = glob($pattern, GLOB_BRACE);

        if (!$files) {
            return;
        }

        foreach ($files as $file) {
            $fileTime = filemtime($file);

            if (
                !isset($this->processedFiles[$file]) ||
                $this->processedFiles[$file] < $fileTime
            ) {
                echo "📄 New or updated file detected: $file\n";
                sleep(1); // Allow file write to complete

                if ($this->processor->processFile($file)) {
                    $this->processedFiles[$file] = $fileTime;
                }
            }
        }
    }
}

/**
 * Main application class
 */
class RealtimeIngestionApp
{
    private TokenManager $tokenManager;
    private ContentProcessor $processor;
    private DirectoryWatcher $watcher;
    private Client $httpClient;

    public function __construct()
    {
        // Validate credentials
        $clientId = $_ENV["GLOO_CLIENT_ID"] ?? "";
        $clientSecret = $_ENV["GLOO_CLIENT_SECRET"] ?? "";

        if (
            empty($clientId) ||
            empty($clientSecret) ||
            $clientId === "YOUR_CLIENT_ID" ||
            $clientSecret === "YOUR_CLIENT_SECRET"
        ) {
            $this->printCredentialError();
            exit(1);
        }

        // Initialize components
        $this->httpClient = new Client();
        $this->tokenManager = new TokenManager(
            $this->httpClient,
            $clientId,
            $clientSecret,
        );
        $this->processor = new ContentProcessor(
            $this->tokenManager,
            $this->httpClient,
        );
        $this->watcher = new DirectoryWatcher($this->processor);
    }

    /**
     * Process all supported files in a directory
     */
    public function batchProcessDirectory(string $directoryPath): void
    {
        if (!is_dir($directoryPath)) {
            echo "Directory does not exist: $directoryPath\n";
            return;
        }

        $pattern =
            $directoryPath .
            "/*{" .
            implode(",", Config::SUPPORTED_EXTENSIONS) .
            "}";
        $files = glob($pattern, GLOB_BRACE);

        if (!$files || empty($files)) {
            echo "No supported files found in: $directoryPath\n";
            return;
        }

        echo "Found " . count($files) . " files to process\n";

        $processed = 0;
        $failed = 0;

        foreach ($files as $file) {
            if ($this->processor->processFile($file)) {
                $processed++;
            } else {
                $failed++;
            }

            // Rate limiting - avoid overwhelming the API
            sleep(Config::RATE_LIMIT_DELAY);
        }

        echo "\n📊 Batch processing complete:\n";
        echo "   ✅ Processed: $processed files\n";
        echo "   ❌ Failed: $failed files\n";
    }

    /**
     * Start directory monitoring
     */
    public function startWatching(string $directory): void
    {
        $this->watcher->watch($directory);
    }

    /**
     * Process a single file
     */
    public function processSingleFile(string $filePath): void
    {
        $success = $this->processor->processFile($filePath);
        if (!$success) {
            exit(1);
        }
    }

    /**
     * Print usage information
     */
    public function printUsage(): void
    {
        echo "Usage:\n";
        echo "  php index.php watch <directory>     # Monitor directory for new files\n";
        echo "  php index.php batch <directory>     # Process all files in directory\n";
        echo "  php index.php single <file_path>    # Process single file\n";
        echo "\n";
        echo "Examples:\n";
        echo "  php index.php watch ./sample_content\n";
        echo "  php index.php batch ./sample_content\n";
        echo "  php index.php single ./sample_content/article.txt\n";
        echo "\n";
        echo "Composer Scripts:\n";
        echo "  composer run single    # Process sample article\n";
        echo "  composer run batch     # Process sample_content directory\n";
        echo "  composer run watch     # Monitor sample_content directory\n";
    }

    /**
     * Print credential configuration error
     */
    private function printCredentialError(): void
    {
        echo "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set\n";
        echo "Create a .env file with your credentials:\n";
        echo "GLOO_CLIENT_ID=your_client_id_here\n";
        echo "GLOO_CLIENT_SECRET=your_client_secret_here\n";
    }
}

/**
 * Main entry point
 */
function main(): void
{
    global $argc, $argv;

    try {
        $app = new RealtimeIngestionApp();

        if ($argc < 2) {
            $app->printUsage();
            exit(1);
        }

        $command = strtolower($argv[1]);

        switch ($command) {
            case "watch":
                if ($argc < 3) {
                    echo "Error: Please specify a directory to watch\n";
                    $app->printUsage();
                    exit(1);
                }
                $app->startWatching($argv[2]);
                break;

            case "batch":
                if ($argc < 3) {
                    echo "Error: Please specify a directory to process\n";
                    $app->printUsage();
                    exit(1);
                }
                $app->batchProcessDirectory($argv[2]);
                break;

            case "single":
                if ($argc < 3) {
                    echo "Error: Please specify a file to process\n";
                    $app->printUsage();
                    exit(1);
                }
                $app->processSingleFile($argv[2]);
                break;

            default:
                echo "Error: Invalid command '$command'\n";
                $app->printUsage();
                exit(1);
        }
    } catch (Exception $e) {
        echo "❌ An error occurred: " . $e->getMessage() . "\n";
        exit(1);
    }
}

// Run the application
global $argc, $argv;
main();

?>
