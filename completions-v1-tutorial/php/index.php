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
$API_KEY = $_ENV['GLOO_API_KEY'] ?? 'YOUR_API_KEY';
$API_URL = 'https://platform.ai.gloo.com/ai/v1/chat/completions';

/**
 * Make a chat completion request
 */
function makeChatCompletionRequest($message = 'How can I be joyful in hard times?') {
    global $API_URL, $API_KEY;

    $payload = [
        'model' => 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        'messages' => [['role' => 'user', 'content' => $message]]
    ];

    $headers = [
        'Authorization: Bearer ' . $API_KEY,
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
    global $API_KEY;

    if ($API_KEY === 'YOUR_API_KEY') {
        echo "Please set your GLOO_API_KEY environment variable\n";
        echo "You can create a .env file with:\n";
        echo "GLOO_API_KEY=your_api_key\n";
        return;
    }

    testCompletionsAPI();
}

// Run the main function
main();
?>
