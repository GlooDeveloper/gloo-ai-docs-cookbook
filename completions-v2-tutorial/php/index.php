<?php
/**
 * Gloo AI Completions V2 Tutorial - PHP
 *
 * This example demonstrates how to use the Gloo AI Completions V2 API
 * with its three routing strategies: auto-routing, model family selection,
 * and direct model selection.
 */

require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuration
$API_KEY = $_ENV['GLOO_API_KEY'] ?? getenv('GLOO_API_KEY') ?: 'YOUR_API_KEY';
$API_URL = 'https://platform.ai.gloo.com/ai/v2/guarded/chat/completions';

/**
 * Make an API request
 */
function makeRequest($apiUrl, $payload, $apiKey) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ]);

    $result = curl_exec($ch);
    if (curl_errno($ch)) {
        throw new Exception('API request failed: ' . curl_error($ch));
    }
    curl_close($ch);

    return json_decode($result, true);
}

/**
 * Example 1: Auto-routing - Let Gloo AI select the optimal model
 */
function makeV2AutoRouting($message, $tradition, $apiUrl, $apiKey) {
    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'auto_routing' => true,
        'tradition' => $tradition
    ];

    return makeRequest($apiUrl, $payload, $apiKey);
}

/**
 * Example 2: Model family selection - Choose a provider family
 */
function makeV2ModelFamily($message, $modelFamily, $apiUrl, $apiKey) {
    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'model_family' => $modelFamily
    ];

    return makeRequest($apiUrl, $payload, $apiKey);
}

/**
 * Example 3: Direct model selection - Specify an exact model
 */
function makeV2DirectModel($message, $model, $apiUrl, $apiKey) {
    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'model' => $model,
        'temperature' => 0.7,
        'max_tokens' => 500
    ];

    return makeRequest($apiUrl, $payload, $apiKey);
}

// Main execution
if ($API_KEY === 'YOUR_API_KEY') {
    echo "Please set your GLOO_API_KEY environment variable\n";
    echo "You can create a .env file with:\n";
    echo "GLOO_API_KEY=your_api_key\n";
    exit(1);
}

echo "=== Gloo AI Completions V2 API Test ===\n\n";

try {
    // Example 1: Auto-routing
    echo "Example 1: Auto-Routing\n";
    echo "Testing: How does the Old Testament connect to the New Testament?\n";
    $result1 = makeV2AutoRouting(
        "How does the Old Testament connect to the New Testament?",
        "evangelical",
        $API_URL, $API_KEY
    );
    echo "   Model used: " . ($result1['model'] ?? 'N/A') . "\n";
    echo "   Routing: " . ($result1['routing_mechanism'] ?? 'N/A') . "\n";
    echo "   Response: " . substr($result1['choices'][0]['message']['content'], 0, 100) . "...\n";
    echo "   ✓ Auto-routing test passed\n\n";

    // Example 2: Model family selection
    echo "Example 2: Model Family Selection\n";
    echo "Testing: Draft a short sermon outline on forgiveness.\n";
    $result2 = makeV2ModelFamily(
        "Draft a short sermon outline on forgiveness.",
        "anthropic",
        $API_URL, $API_KEY
    );
    echo "   Model used: " . ($result2['model'] ?? 'N/A') . "\n";
    echo "   Response: " . substr($result2['choices'][0]['message']['content'], 0, 100) . "...\n";
    echo "   ✓ Model family test passed\n\n";

    // Example 3: Direct model selection
    echo "Example 3: Direct Model Selection\n";
    echo "Testing: Summarize the book of Romans in 3 sentences.\n";
    $result3 = makeV2DirectModel(
        "Summarize the book of Romans in 3 sentences.",
        "gloo-anthropic-claude-sonnet-4.5",
        $API_URL, $API_KEY
    );
    echo "   Model used: " . ($result3['model'] ?? 'N/A') . "\n";
    echo "   Response: " . substr($result3['choices'][0]['message']['content'], 0, 100) . "...\n";
    echo "   ✓ Direct model test passed\n\n";

    echo "=== All Completions V2 tests passed! ===\n";

} catch (Exception $e) {
    echo "✗ Test failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
