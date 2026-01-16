package com.gloo.completions;

import com.google.gson.Gson;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

/**
 * Gloo AI Completions Tutorial - Java
 * 
 * This example demonstrates how to use the Gloo AI Completions API
 * to generate text completions using the chat/completions endpoint.
 */
public class CompletionsTutorial {
    
    // Configuration
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions";
    
    // HTTP client and JSON parser
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private static final Gson gson = new Gson();
    
    // Global token storage
    private static TokenInfo tokenInfo;
    
    // Load environment variables
    private static final Dotenv dotenv = Dotenv.configure()
            .ignoreIfMissing()
            .load();
    
    private static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    private static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    
    /**
     * TokenInfo represents the OAuth2 token response
     */
    public static class TokenInfo {
        public String access_token;
        public int expires_in;
        public long expires_at;
        public String token_type;
    }
    
    /**
     * ChatMessage represents a chat message
     */
    public static class ChatMessage {
        public String role;
        public String content;
        
        public ChatMessage(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }
    
    /**
     * ChatCompletionRequest represents the request payload
     */
    public static class ChatCompletionRequest {
        public String model;
        public List<ChatMessage> messages;
        
        public ChatCompletionRequest(String model, List<ChatMessage> messages) {
            this.model = model;
            this.messages = messages;
        }
    }
    
    /**
     * ChatCompletionResponse represents the API response
     */
    public static class ChatCompletionResponse {
        public List<Choice> choices;
        
        public static class Choice {
            public Message message;
            
            public static class Message {
                public String role;
                public String content;
            }
        }
    }
    
    /**
     * Retrieve a new access token from the Gloo AI API
     */
    public static TokenInfo getAccessToken() throws IOException, InterruptedException {
        String auth = CLIENT_ID + ":" + CLIENT_SECRET;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        String requestBody = "grant_type=client_credentials&scope=api/access";
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            throw new IOException("Failed to get access token: HTTP " + response.statusCode() + " - " + response.body());
        }
        
        TokenInfo token = gson.fromJson(response.body(), TokenInfo.class);
        token.expires_at = Instant.now().getEpochSecond() + token.expires_in;
        
        return token;
    }
    
    /**
     * Check if the token is expired or close to expiring
     */
    public static boolean isTokenExpired(TokenInfo token) {
        if (token == null || token.expires_at == 0) {
            return true;
        }
        return Instant.now().getEpochSecond() > (token.expires_at - 60);
    }
    
    /**
     * Ensure we have a valid access token
     */
    public static String ensureValidToken() throws IOException, InterruptedException {
        if (isTokenExpired(tokenInfo)) {
            System.out.println("Getting new access token...");
            tokenInfo = getAccessToken();
        }
        return tokenInfo.access_token;
    }
    
    /**
     * Make a chat completion request
     */
    public static ChatCompletionResponse makeChatCompletionRequest(String message) 
            throws IOException, InterruptedException {
        String token = ensureValidToken();
        
        ChatCompletionRequest request = new ChatCompletionRequest(
            "us.anthropic.claude-sonnet-4-20250514-v1:0",
            List.of(new ChatMessage("user", message))
        );
        
        String jsonPayload = gson.toJson(request);
        
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();
        
        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            throw new IOException("API call failed: HTTP " + response.statusCode() + " - " + response.body());
        }
        
        return gson.fromJson(response.body(), ChatCompletionResponse.class);
    }
    
    /**
     * Test the completions API with multiple examples
     */
    public static boolean testCompletionsAPI() {
        System.out.println("=== Gloo AI Completions API Test ===\n");
        
        String[] testMessages = {
            "How can I be joyful in hard times?",
            "What are the benefits of a positive mindset?",
            "How do I build meaningful relationships?"
        };
        
        try {
            for (int i = 0; i < testMessages.length; i++) {
                String message = testMessages[i];
                System.out.println("Test " + (i + 1) + ": " + message);
                
                ChatCompletionResponse completion = makeChatCompletionRequest(message);
                
                System.out.println("   ✓ Completion successful");
                String content = completion.choices.get(0).message.content;
                if (content.length() > 100) {
                    content = content.substring(0, 100) + "...";
                }
                System.out.println("   Response: " + content + "\n");
            }
            
            System.out.println("=== All completion tests passed! ===");
            return true;
            
        } catch (Exception e) {
            System.err.println("✗ Completion test failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Main method - entry point
     */
    public static void main(String[] args) {
        if (CLIENT_ID.equals("YOUR_CLIENT_ID") || CLIENT_SECRET.equals("YOUR_CLIENT_SECRET")) {
            System.out.println("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
            System.out.println("You can create a .env file with:");
            System.out.println("GLOO_CLIENT_ID=your_client_id");
            System.out.println("GLOO_CLIENT_SECRET=your_client_secret");
            return;
        }
        
        testCompletionsAPI();
    }
}