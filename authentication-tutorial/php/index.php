#!/usr/bin/env php
<?php

/**
 * Gloo AI Authentication Tutorial - PHP
 *
 * This example demonstrates how to authenticate with the Gloo AI API
 * using API key authentication.
 */

require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuration
$API_KEY = $_ENV['GLOO_API_KEY'] ?? '';
$API_URL = 'https://platform.ai.gloo.com/ai/v2/guarded/chat/completions';

/**
 * Validate that the required API key is configured
 */
function validateCredentials() {
    global $API_KEY;

    if (empty($API_KEY)) {
        echo "Please set your GLOO_API_KEY environment variable\n";
        echo "You can create a .env file with:\n";
        echo "GLOO_API_KEY=your_api_key\n";
        return false;
    }
    return true;
}

/**
 * Make an authenticated API request using the API key
 */
function makeAuthenticatedRequest($endpoint, $payload = null) {
    global $API_KEY;

    $headers = [
        'Authorization: Bearer ' . $API_KEY,
        'Content-Type: application/json'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($payload) {
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        curl_close($ch);
        throw new Exception('cURL error: ' . curl_error($ch));
    }

    curl_close($ch);

    if ($http_code !== 200) {
        throw new Exception("HTTP $http_code: $result");
    }

    $response = json_decode($result, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON decode error: ' . json_last_error_msg());
    }

    return $response;
}

/**
 * Test the authentication implementation
 */
function testAuthentication() {
    global $API_URL;

    echo "=== Gloo AI Authentication Test ===\n\n";

    try {
        // Test 1: Verify API key is configured
        echo "1. Verifying API key is configured...\n";
        if (!validateCredentials()) {
            return false;
        }
        echo "   API key is set\n\n";

        // Test 2: API call with authentication
        echo "2. Testing authenticated API call...\n";
        $result = makeAuthenticatedRequest($API_URL, [
            'auto_routing' => true,
            'messages' => [['role' => 'user', 'content' => 'Hello! This is a test of the authentication system.']]
        ]);

        echo "   API call successful\n";
        echo "   Response: " . substr($result['choices'][0]['message']['content'], 0, 100) . "...\n\n";

        echo "=== All tests passed! ===\n";
        return true;

    } catch (Exception $e) {
        echo "Authentication test failed: " . $e->getMessage() . "\n";
        return false;
    }
}

/**
 * Main execution
 */
function main() {
    if (!validateCredentials()) {
        return;
    }

    testAuthentication();
}

// Run the main function
main();
?>
