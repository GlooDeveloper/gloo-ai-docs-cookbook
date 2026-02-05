#!/usr/bin/env php
<?php
/**
 * Grounded Completions Recipe - PHP Implementation
 *
 * This script demonstrates the difference between non-grounded and grounded
 * completions using Gloo AI's RAG (Retrieval-Augmented Generation) capabilities.
 *
 * It compares responses from a standard completion (which may hallucinate)
 * against a grounded completion (which uses your actual content).
 */

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuration
$glooClientId = $_ENV['GLOO_CLIENT_ID'] ?? null;
$glooClientSecret = $_ENV['GLOO_CLIENT_SECRET'] ?? null;
$publisherName = $_ENV['PUBLISHER_NAME'] ?? 'Bezalel';

// API Endpoints
const TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
const COMPLETIONS_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';
const GROUNDED_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions/grounded';

// Token management
$accessToken = null;
$tokenExpiry = null;

/**
 * Retrieve an OAuth2 access token from Gloo AI.
 *
 * @return array Token response containing access_token and expires_in
 * @throws Exception If credentials are missing or request fails
 */
function getAccessToken() {
    global $glooClientId, $glooClientSecret;

    if (empty($glooClientId) || empty($glooClientSecret)) {
        throw new Exception(
            'Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET ' .
            'environment variables.'
        );
    }

    $params = http_build_query([
        'grant_type' => 'client_credentials',
        'client_id' => $glooClientId,
        'client_secret' => $glooClientSecret
    ]);

    $ch = curl_init(TOKEN_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Failed to get access token. HTTP $httpCode");
    }

    return json_decode($response, true);
}

/**
 * Ensure we have a valid access token, refreshing if necessary.
 *
 * @return string Valid access token
 */
function ensureValidToken() {
    global $accessToken, $tokenExpiry;

    // Check if we need a new token
    if ($accessToken === null || $tokenExpiry === null || time() >= $tokenExpiry) {
        $tokenData = getAccessToken();
        $accessToken = $tokenData['access_token'];
        // Set expiry with 5 minute buffer
        $expiresIn = $tokenData['expires_in'] ?? 3600;
        $tokenExpiry = time() + $expiresIn - 300;
    }

    return $accessToken;
}

/**
 * Make a standard V2 completion request WITHOUT grounding.
 *
 * This uses the model's general knowledge and may produce generic
 * or potentially inaccurate responses about your specific content.
 *
 * @param string $query The user's question
 * @return array API response
 * @throws Exception If request fails
 */
function makeNonGroundedRequest($query) {
    $token = ensureValidToken();

    $payload = [
        'messages' => [['role' => 'user', 'content' => $query]],
        'auto_routing' => true,
        'max_tokens' => 500
    ];

    $ch = curl_init(COMPLETIONS_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Non-grounded request failed. HTTP $httpCode");
    }

    return json_decode($response, true);
}

/**
 * Make a grounded completion request using Gloo's default dataset.
 *
 * This retrieves relevant content from Gloo's default faith-based content
 * before generating a response. Good for general religious questions,
 * but won't have specific information about your organization.
 *
 * @param string $query The user's question
 * @param int $sourcesLimit Maximum number of sources to use (default: 3)
 * @return array API response with sources_returned flag
 * @throws Exception If request fails
 */
function makeDefaultGroundedRequest($query, $sourcesLimit = 3) {
    $token = ensureValidToken();

    $payload = [
        'messages' => [['role' => 'user', 'content' => $query]],
        'auto_routing' => true,
        'sources_limit' => $sourcesLimit,
        'max_tokens' => 500
    ];

    $ch = curl_init(GROUNDED_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Default grounded request failed. HTTP $httpCode");
    }

    return json_decode($response, true);
}

/**
 * Make a grounded completion request WITH RAG on your specific publisher.
 *
 * This retrieves relevant content from your publisher before generating
 * a response, resulting in accurate, source-backed answers specific to
 * your organization.
 *
 * @param string $query The user's question
 * @param string $publisherName Name of the publisher in Gloo Studio
 * @param int $sourcesLimit Maximum number of sources to use (default: 3)
 * @return array API response with sources_returned flag
 * @throws Exception If request fails
 */
function makePublisherGroundedRequest($query, $publisherName, $sourcesLimit = 3) {
    $token = ensureValidToken();

    $payload = [
        'messages' => [['role' => 'user', 'content' => $query]],
        'auto_routing' => true,
        'rag_publisher' => $publisherName,
        'sources_limit' => $sourcesLimit,
        'max_tokens' => 500
    ];

    $ch = curl_init(GROUNDED_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Publisher grounded request failed. HTTP $httpCode");
    }

    return json_decode($response, true);
}

/**
 * Compare non-grounded vs default grounded vs publisher grounded responses.
 *
 * This is the main demo function that shows the progression from generic
 * responses to organization-specific answers through RAG.
 *
 * @param string $query The question to ask
 * @param string $publisherName Name of the publisher in Gloo Studio
 */
function compareResponses($query, $publisherName) {
    echo "\n" . str_repeat('=', 80) . "\n";
    echo "Query: $query\n";
    echo str_repeat('=', 80) . "\n";

    // Non-grounded response
    echo "\n🔹 STEP 1: NON-GROUNDED Response (Generic Model Knowledge):\n";
    echo str_repeat('-', 80) . "\n";
    try {
        $nonGrounded = makeNonGroundedRequest($query);
        $content = $nonGrounded['choices'][0]['message']['content'];
        echo $content . "\n";
        echo "\n📊 Metadata:\n";
        $sourcesUsed = $nonGrounded['sources_returned'] ?? false;
        echo "   Sources used: " . ($sourcesUsed ? 'true' : 'false') . "\n";
        echo "   Model: " . ($nonGrounded['model'] ?? 'N/A') . "\n";
    } catch (Exception $e) {
        echo "❌ Error: " . $e->getMessage() . "\n";
    }

    echo "\n" . str_repeat('=', 80) . "\n\n";

    // Default grounded response
    echo "🔹 STEP 2: GROUNDED on Default Dataset (Gloo's Faith-Based Content):\n";
    echo str_repeat('-', 80) . "\n";
    try {
        $defaultGrounded = makeDefaultGroundedRequest($query);
        $content = $defaultGrounded['choices'][0]['message']['content'];
        echo $content . "\n";
        echo "\n📊 Metadata:\n";
        $sourcesUsed = $defaultGrounded['sources_returned'] ?? false;
        echo "   Sources used: " . ($sourcesUsed ? 'true' : 'false') . "\n";
        echo "   Model: " . ($defaultGrounded['model'] ?? 'N/A') . "\n";
    } catch (Exception $e) {
        echo "❌ Error: " . $e->getMessage() . "\n";
    }

    echo "\n" . str_repeat('=', 80) . "\n\n";

    // Publisher grounded response
    echo "🔹 STEP 3: GROUNDED on Your Publisher (Your Specific Content):\n";
    echo str_repeat('-', 80) . "\n";
    try {
        $publisherGrounded = makePublisherGroundedRequest($query, $publisherName);
        $content = $publisherGrounded['choices'][0]['message']['content'];
        echo $content . "\n";
        echo "\n📊 Metadata:\n";
        $sourcesUsed = $publisherGrounded['sources_returned'] ?? false;
        echo "   Sources used: " . ($sourcesUsed ? 'true' : 'false') . "\n";
        echo "   Model: " . ($publisherGrounded['model'] ?? 'N/A') . "\n";
    } catch (Exception $e) {
        echo "❌ Error: " . $e->getMessage() . "\n";
    }

    echo "\n" . str_repeat('=', 80) . "\n\n";
}

/**
 * Prompt user for input.
 */
function promptToContinue() {
    readline('Press Enter to continue to next comparison...');
}

/**
 * Run the grounded completions comparison demo.
 *
 * Tests multiple queries to demonstrate the value of RAG in reducing
 * hallucinations and providing accurate, source-backed responses.
 */
function main() {
    global $publisherName;

    echo "\n" . str_repeat('=', 80) . "\n";
    echo "  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses\n";
    echo str_repeat('=', 80) . "\n";
    echo "\nPublisher: $publisherName\n";
    echo "This demo shows a 3-step progression:\n";
    echo "  1. Non-grounded (generic model knowledge)\n";
    echo "  2. Grounded on default dataset (Gloo's faith-based content)\n";
    echo "  3. Grounded on your publisher (your specific content)\n";
    echo "\nNote: For org-specific queries like Bezalel's hiring process,\n";
    echo "both steps 1 and 2 may lack specific details, while step 3\n";
    echo "provides accurate, source-backed answers from your content.\n\n";

    // Test queries that demonstrate clear differences
    $queries = [
        "What is Bezalel Ministries' hiring process?",
        "What educational resources does Bezalel Ministries provide?",
        "Describe Bezalel's research methodology for creating artwork."
    ];

    foreach ($queries as $i => $query) {
        $num = $i + 1;
        $total = count($queries);

        echo "\n" . str_repeat('#', 80) . "\n";
        echo "# COMPARISON $num of $total\n";
        echo str_repeat('#', 80) . "\n";

        compareResponses($query, $publisherName);

        // Pause between comparisons for readability
        if ($i < count($queries) - 1) {
            promptToContinue();
        }
    }

    echo "\n" . str_repeat('=', 80) . "\n";
    echo "  Demo Complete!\n";
    echo str_repeat('=', 80) . "\n";
    echo "\nKey Takeaways:\n";
    echo "✓ Step 1 (Non-grounded): Generic model knowledge, may hallucinate\n";
    echo "✓ Step 2 (Default grounded): Uses Gloo's faith-based content, better for\n";
    echo "  general questions but lacks org-specific details\n";
    echo "✓ Step 3 (Publisher grounded): Your specific content, accurate and\n";
    echo "  source-backed (sources_returned: true)\n";
    echo "✓ Grounding on relevant content is key - generic grounding may not help\n";
    echo "  for organization-specific queries\n";
    echo "\nNext Steps:\n";
    echo "• Upload your own content to a Publisher in Gloo Studio\n";
    echo "• Update PUBLISHER_NAME in .env to use your content\n";
    echo "• Try both general and specific queries to see the differences!\n";
    echo "\n";
}

// Run the demo
if (php_sapi_name() === 'cli') {
    try {
        main();
    } catch (Exception $e) {
        fwrite(STDERR, "Fatal error: " . $e->getMessage() . "\n");
        exit(1);
    }
}
