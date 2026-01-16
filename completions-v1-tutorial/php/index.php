#!/usr/bin/env php
<?php

/**
 * Gloo AI Completions Tutorial - PHP
 * 
 * This example demonstrates how to use the Gloo AI Completions API
 * to generate text completions using the chat/completions endpoint.
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
 * Make a chat completion request
 */
function makeChatCompletionRequest($message = 'How can I be joyful in hard times?') {
    global $API_URL;
    $token = ensureValidToken();
    
    $payload = [
        'model' => 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        'messages' => [['role' => 'user', 'content' => $message]]
    ];
    
    $headers = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $API_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
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
 * Test the completions API with multiple examples
 */
function testCompletionsAPI() {
    echo "=== Gloo AI Completions API Test ===\n\n";
    
    $test_messages = [
        "How can I be joyful in hard times?",
        "What are the benefits of a positive mindset?",
        "How do I build meaningful relationships?"
    ];
    
    try {
        foreach ($test_messages as $index => $message) {
            echo "Test " . ($index + 1) . ": $message\n";
            
            $completion = makeChatCompletionRequest($message);
            
            echo "✓ Completion successful\n";
            echo "Response: " . substr($completion['choices'][0]['message']['content'], 0, 100) . "...\n\n";
        }
        
        echo "=== All completion tests passed! ===\n";
        return true;
        
    } catch (Exception $e) {
        echo "✗ Completion test failed: " . $e->getMessage() . "\n";
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
    
    testCompletionsAPI();
}

// Run the main function
main();
?>