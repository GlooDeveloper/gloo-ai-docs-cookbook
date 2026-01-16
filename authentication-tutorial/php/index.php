#!/usr/bin/env php
<?php

/**
 * Gloo AI Authentication Tutorial - PHP
 * 
 * This example demonstrates how to authenticate with the Gloo AI API
 * using OAuth2 client credentials flow.
 */

require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuration
$CLIENT_ID = $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID';
$CLIENT_SECRET = $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET';
$TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
$API_URL = 'https://platform.ai.gloo.com/ai/v1/chat/completions';

// Global token storage
$token_info = [];

/**
 * Retrieve a new access token from the Gloo AI API
 */
function getAccessToken($client_id, $client_secret, $token_url) {
    $post_data = 'grant_type=client_credentials&scope=api/access';
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
    curl_setopt($ch, CURLOPT_USERPWD, $client_id . ':' . $client_secret);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    
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
    
    $token_data = json_decode($result, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON decode error: ' . json_last_error_msg());
    }
    
    $token_data['expires_at'] = time() + $token_data['expires_in'];
    
    return $token_data;
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
function ensureValidToken() {
    global $token_info, $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL;
    
    if (isTokenExpired($token_info)) {
        echo "Getting new access token...\n";
        $token_info = getAccessToken($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
    }
    
    return $token_info['access_token'];
}

/**
 * Make an authenticated API request
 */
function makeAuthenticatedRequest($endpoint, $payload = null) {
    $token = ensureValidToken();
    
    $headers = [
        'Authorization: Bearer ' . $token,
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
    global $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL, $API_URL;
    
    echo "=== Gloo AI Authentication Test ===\n\n";
    
    try {
        // Test 1: Token retrieval
        echo "1. Testing token retrieval...\n";
        $token_info = getAccessToken($CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
        echo "   ✓ Token retrieved successfully\n";
        echo "   Token type: " . $token_info['token_type'] . "\n";
        echo "   Expires in: " . $token_info['expires_in'] . " seconds\n\n";
        
        // Test 2: Token validation
        echo "2. Testing token validation...\n";
        $token = ensureValidToken();
        echo "   ✓ Token validation successful\n\n";
        
        // Test 3: API call with authentication
        echo "3. Testing authenticated API call...\n";
        $result = makeAuthenticatedRequest($API_URL, [
            'model' => 'us.anthropic.claude-sonnet-4-20250514-v1:0',
            'messages' => [['role' => 'user', 'content' => 'Hello! This is a test of the authentication system.']]
        ]);
        
        echo "   ✓ API call successful\n";
        echo "   Response: " . substr($result['choices'][0]['message']['content'], 0, 100) . "...\n\n";
        
        echo "=== All tests passed! ===\n";
        return true;
        
    } catch (Exception $e) {
        echo "✗ Authentication test failed: " . $e->getMessage() . "\n";
        return false;
    }
}

/**
 * Main execution
 */
function main() {
    global $CLIENT_ID, $CLIENT_SECRET;
    
    if ($CLIENT_ID === 'YOUR_CLIENT_ID' || $CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
        echo "Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables\n";
        echo "You can create a .env file with:\n";
        echo "GLOO_CLIENT_ID=your_client_id\n";
        echo "GLOO_CLIENT_SECRET=your_client_secret\n";
        return;
    }
    
    testAuthentication();
}

// Run the main function
main();
?>