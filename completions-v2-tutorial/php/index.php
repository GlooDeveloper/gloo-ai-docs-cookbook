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
$CLIENT_ID = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID') ?: 'YOUR_CLIENT_ID';
$CLIENT_SECRET = $_ENV['GLOO_CLIENT_SECRET'] ?? getenv('GLOO_CLIENT_SECRET') ?: 'YOUR_CLIENT_SECRET';
$TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
$API_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

// Global token storage
$tokenInfo = [];

/**
 * Retrieve a new access token from the Gloo AI API
 */
function getAccessToken($clientId, $clientSecret, $tokenUrl) {
    $postData = 'grant_type=client_credentials&scope=api/access';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_USERPWD, $clientId . ':' . $clientSecret);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $result = curl_exec($ch);
    if (curl_errno($ch)) {
        throw new Exception('Error getting access token: ' . curl_error($ch));
    }
    curl_close($ch);

    $tokenData = json_decode($result, true);
    $tokenData['expires_at'] = time() + $tokenData['expires_in'];

    return $tokenData;
}

/**
 * Check if the token is expired or close to expiring
 */
function isTokenExpired($token) {
    if (empty($token) || !isset($token['expires_at'])) {
        return true;
    }
    return time() > ($token['expires_at'] - 60);
}

/**
 * Ensure we have a valid access token
 */
function ensureValidToken(&$tokenInfo, $clientId, $clientSecret, $tokenUrl) {
    if (isTokenExpired($tokenInfo)) {
        echo "Getting new access token...\n";
        $tokenInfo = getAccessToken($clientId, $clientSecret, $tokenUrl);
    }
    return $tokenInfo;
}

/**
 * Make an API request
 */
function makeRequest($apiUrl, $payload, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token['access_token'],
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
function makeV2AutoRouting($message, $tradition, $apiUrl, &$tokenInfo, $clientId, $clientSecret, $tokenUrl) {
    $token = ensureValidToken($tokenInfo, $clientId, $clientSecret, $tokenUrl);

    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'auto_routing' => true,
        'tradition' => $tradition
    ];

    return makeRequest($apiUrl, $payload, $token);
}

/**
 * Example 2: Model family selection - Choose a provider family
 */
function makeV2ModelFamily($message, $modelFamily, $apiUrl, &$tokenInfo, $clientId, $clientSecret, $tokenUrl) {
    $token = ensureValidToken($tokenInfo, $clientId, $clientSecret, $tokenUrl);

    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'model_family' => $modelFamily
    ];

    return makeRequest($apiUrl, $payload, $token);
}

/**
 * Example 3: Direct model selection - Specify an exact model
 */
function makeV2DirectModel($message, $model, $apiUrl, &$tokenInfo, $clientId, $clientSecret, $tokenUrl) {
    $token = ensureValidToken($tokenInfo, $clientId, $clientSecret, $tokenUrl);

    $payload = [
        'messages' => [['role' => 'user', 'content' => $message]],
        'model' => $model,
        'temperature' => 0.7,
        'max_tokens' => 500
    ];

    return makeRequest($apiUrl, $payload, $token);
}

// Main execution
if ($CLIENT_ID === 'YOUR_CLIENT_ID' || $CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
    echo "Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables\n";
    echo "You can create a .env file with:\n";
    echo "GLOO_CLIENT_ID=your_client_id\n";
    echo "GLOO_CLIENT_SECRET=your_client_secret\n";
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
        $API_URL, $tokenInfo, $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL
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
        $API_URL, $tokenInfo, $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL
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
        $API_URL, $tokenInfo, $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL
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
