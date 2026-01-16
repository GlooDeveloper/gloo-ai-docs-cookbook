#!/usr/bin/env php
<?php

/**
 * Gloo AI Chat Message Tutorial - PHP Example
 * 
 * This example demonstrates how to:
 * 1. Authenticate with the Gloo AI API using OAuth2
 * 2. Create a new chat session with suggestions enabled
 * 3. Continue a conversation using suggested responses
 * 4. Retrieve and display chat history (optional)
 * 5. Handle errors gracefully with proper PHP practices
 * 
 * Key Learning Points:
 * - Step 2: Create chat with suggestions enabled
 * - Step 3: Continue conversation using chat_id (no history retrieval needed)
 * - Step 4: Optionally retrieve chat history for display
 * 
 * Prerequisites:
 * - PHP 8.1+
 * - Composer dependencies: guzzlehttp/guzzle vlucas/phpdotenv
 * - Create a .env file with your credentials:
 *   GLOO_CLIENT_ID=your_client_id
 *   GLOO_CLIENT_SECRET=your_client_secret
 * 
 * Usage:
 *     php index.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuration
const TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
const MESSAGE_API_URL = 'https://platform.ai.gloo.com/ai/v1/message';
const CHAT_API_URL = 'https://platform.ai.gloo.com/ai/v1/chat';

// Data classes for type safety
class TokenInfo {
    public string $access_token;
    public int $expires_in;
    public int $expires_at;
    public string $token_type;
    
    public function __construct(array $data) {
        $this->access_token = $data['access_token'];
        $this->expires_in = $data['expires_in'];
        $this->expires_at = time() + $data['expires_in'];
        $this->token_type = $data['token_type'];
    }
}

class MessageResponse {
    public string $chat_id;
    public string $query_id;
    public string $message_id;
    public string $message;
    public string $timestamp;
    public bool $success;
    public array $suggestions;
    public array $sources;
    
    public function __construct(array $data) {
        $this->chat_id = $data['chat_id'];
        $this->query_id = $data['query_id'];
        $this->message_id = $data['message_id'];
        $this->message = $data['message'];
        $this->timestamp = $data['timestamp'];
        $this->success = $data['success'];
        $this->suggestions = $data['suggestions'] ?? [];
        $this->sources = $data['sources'] ?? [];
    }
}

class ChatMessage {
    public string $query_id;
    public string $message_id;
    public string $timestamp;
    public string $role;
    public string $message;
    public ?int $character_limit;
    
    public function __construct(array $data) {
        $this->query_id = $data['query_id'];
        $this->message_id = $data['message_id'];
        $this->timestamp = $data['timestamp'];
        $this->role = $data['role'];
        $this->message = $data['message'];
        $this->character_limit = $data['character_limit'] ?? null;
    }
}

class ChatHistory {
    public string $chat_id;
    public string $created_at;
    /** @var ChatMessage[] */
    public array $messages;
    
    public function __construct(array $data) {
        $this->chat_id = $data['chat_id'];
        $this->created_at = $data['created_at'];
        $this->messages = array_map(fn($msg) => new ChatMessage($msg), $data['messages']);
    }
}

// Custom exception for API errors
class GlooApiException extends Exception {
    public ?int $status_code;
    
    public function __construct(string $message, ?int $status_code = null, ?Throwable $previous = null) {
        $this->status_code = $status_code;
        parent::__construct($message, $status_code ?? 0, $previous);
    }
}

// Global variables
$client_id = $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID';
$client_secret = $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET';
$http_client = new Client(['timeout' => 30]);
$token_info = null;

/**
 * Get a new access token from the Gloo AI API
 */
function getAccessToken(): TokenInfo {
    global $client_id, $client_secret, $http_client;
    
    try {
        $response = $http_client->post(TOKEN_URL, [
            'headers' => [
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            'auth' => [$client_id, $client_secret],
            'form_params' => [
                'grant_type' => 'client_credentials',
                'scope' => 'api/access'
            ]
        ]);
        
        $data = json_decode($response->getBody()->getContents(), true);
        return new TokenInfo($data);
        
    } catch (RequestException $e) {
        $error_msg = 'Authentication failed: ' . $e->getMessage();
        
        if ($e->hasResponse()) {
            $response_body = $e->getResponse()->getBody()->getContents();
            $error_data = json_decode($response_body, true);
            
            if (isset($error_data['detail'])) {
                $error_msg = 'Authentication failed: ' . $error_data['detail'];
            }
        }
        
        throw new GlooApiException($error_msg, $e->getResponse()?->getStatusCode());
    }
}

/**
 * Check if the token is expired or close to expiring
 */
function isTokenExpired(?TokenInfo $token): bool {
    if (!$token) {
        return true;
    }
    return time() > ($token->expires_at - 60);
}

/**
 * Ensure we have a valid access token
 */
function ensureValidToken(): string {
    global $token_info;
    
    if (isTokenExpired($token_info)) {
        echo "Getting new access token...\n";
        $token_info = getAccessToken();
    }
    
    return $token_info->access_token;
}

/**
 * Send a message to the chat API
 */
function sendMessage(string $message_text, ?string $chat_id = null): MessageResponse {
    global $http_client;
    
    try {
        $token = ensureValidToken();
        
        $payload = [
            'query' => $message_text,
            'character_limit' => 1000,
            'sources_limit' => 5,
            'stream' => false,
            'publishers' => [],
            'enable_suggestions' => 1  // Enable suggested follow-up questions
        ];
        
        if ($chat_id) {
            $payload['chat_id'] = $chat_id;
        }
        
        $response = $http_client->post(MESSAGE_API_URL, [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'json' => $payload,
            'timeout' => 60
        ]);
        
        $data = json_decode($response->getBody()->getContents(), true);
        return new MessageResponse($data);
        
    } catch (RequestException $e) {
        $error_msg = 'Message sending failed: ' . $e->getMessage();
        
        if ($e->hasResponse()) {
            $response_body = $e->getResponse()->getBody()->getContents();
            $error_data = json_decode($response_body, true);
            
            if (isset($error_data['detail'])) {
                $error_msg = 'Message sending failed: ' . $error_data['detail'];
            }
        }
        
        throw new GlooApiException($error_msg, $e->getResponse()?->getStatusCode());
    }
}

/**
 * Retrieve the full chat history for a given chat ID
 */
function getChatHistory(string $chat_id): ChatHistory {
    global $http_client;
    
    try {
        $token = ensureValidToken();
        
        $response = $http_client->get(CHAT_API_URL, [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'query' => ['chat_id' => $chat_id]
        ]);
        
        $data = json_decode($response->getBody()->getContents(), true);
        return new ChatHistory($data);
        
    } catch (RequestException $e) {
        $error_msg = 'Chat history retrieval failed: ' . $e->getMessage();
        
        if ($e->hasResponse()) {
            $response_body = $e->getResponse()->getBody()->getContents();
            $error_data = json_decode($response_body, true);
            
            if (isset($error_data['detail'])) {
                $error_msg = 'Chat history retrieval failed: ' . $error_data['detail'];
            }
        }
        
        throw new GlooApiException($error_msg, $e->getResponse()?->getStatusCode());
    }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(string $timestamp): string {
    try {
        $dt = new DateTime($timestamp);
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return $timestamp;
    }
}

/**
 * Validate that required environment variables are set
 */
function validateEnvironment(): void {
    global $client_id, $client_secret;
    
    if ($client_id === 'YOUR_CLIENT_ID' || $client_secret === 'YOUR_CLIENT_SECRET') {
        echo "❌ Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables\n";
        echo "Create a .env file with:\n";
        echo "GLOO_CLIENT_ID=your_client_id\n";
        echo "GLOO_CLIENT_SECRET=your_client_secret\n";
        exit(1);
    }
}

/**
 * Display a chat message with formatting
 */
function displayMessage(ChatMessage $message, int $index): void {
    $role = strtoupper($message->role);
    $timestamp = formatTimestamp($message->timestamp);
    echo sprintf("%d. %s [%s]:\n", $index + 1, $role, $timestamp);
    echo $message->message . "\n\n";
}

/**
 * Main function demonstrating the complete chat flow
 */
function main(): void {
    try {
        // Validate environment
        validateEnvironment();
        
        // Start with a deep, meaningful question about human flourishing
        $initial_question = "How can I find meaning and purpose when facing life's greatest challenges?";
        
        echo "=== Starting New Chat Session ===\n";
        echo "Question: $initial_question\n\n";
        
        // Create new chat session
        $chat_response = sendMessage($initial_question);
        $chat_id = $chat_response->chat_id;
        
        echo "AI Response:\n";
        echo $chat_response->message . "\n\n";
        
        // Show suggested follow-up questions
        if (!empty($chat_response->suggestions)) {
            echo "Suggested follow-up questions:\n";
            foreach ($chat_response->suggestions as $index => $suggestion) {
                echo ($index + 1) . ". " . $suggestion . "\n";
            }
            echo "\n";
        }
        
        // Use the first suggested question for follow-up, or a predefined fallback
        $follow_up_question = !empty($chat_response->suggestions)
        ? $chat_response->suggestions[0]
        : "Can you give me practical steps I can take today to begin this journey?";

        echo "=== Continuing the Conversation ===\n";
        echo "Using suggested question: $follow_up_question\n\n";

        // Send the follow-up message
        $follow_up_response = sendMessage($follow_up_question, $chat_id);
        echo "AI Response:\n";
        echo $follow_up_response->message . "\n\n";

        // Display final chat history
        echo "=== Complete Chat History ===\n";
        $chat_history = getChatHistory($chat_id);
        
        foreach ($chat_history->messages as $i => $message) {
            displayMessage($message, $i);
        }
        
        echo "✅ Chat session completed successfully!\n";
        echo "📊 Total messages: " . count($chat_history->messages) . "\n";
        echo "🔗 Chat ID: $chat_id\n";
        echo "📅 Session created: " . formatTimestamp($chat_history->created_at) . "\n";
        
    } catch (GlooApiException $e) {
        echo "❌ API Error: " . $e->getMessage() . "\n";
        if ($e->status_code) {
            echo "Status Code: " . $e->status_code . "\n";
        }
        exit(1);
    } catch (Exception $e) {
        echo "❌ Unexpected error: " . $e->getMessage() . "\n";
        exit(1);
    }
}

// Run the main function if this file is executed directly
if (basename(__FILE__) === basename($_SERVER['PHP_SELF'])) {
    main();
}