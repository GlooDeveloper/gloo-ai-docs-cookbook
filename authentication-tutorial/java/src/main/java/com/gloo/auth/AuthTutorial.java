package com.gloo.auth;

import com.google.gson.Gson;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Gloo AI Authentication Tutorial - Java
 *
 * This example demonstrates how to authenticate with the Gloo AI API
 * using API key authentication.
 */
public class AuthTutorial {

    // Configuration
    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    // HTTP client and JSON parser
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private static final Gson gson = new Gson();

    // Load environment variables
    private static final Dotenv dotenv = Dotenv.configure()
            .ignoreIfMissing()
            .load();

    private static final String API_KEY = dotenv.get("GLOO_API_KEY", "");

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
        public boolean auto_routing;
        public List<ChatMessage> messages;

        public ChatCompletionRequest(boolean auto_routing, List<ChatMessage> messages) {
            this.auto_routing = auto_routing;
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
     * Validate that the required API key is configured
     */
    public static boolean validateCredentials() {
        if (API_KEY == null || API_KEY.isEmpty()) {
            System.out.println("Please set your GLOO_API_KEY environment variable");
            System.out.println("You can create a .env file with:");
            System.out.println("GLOO_API_KEY=your_api_key");
            return false;
        }
        return true;
    }

    /**
     * Make an authenticated API request using the API key
     */
    public static ChatCompletionResponse makeAuthenticatedRequest(String endpoint, ChatCompletionRequest payload)
            throws IOException, InterruptedException {
        String jsonPayload = gson.toJson(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + API_KEY)
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("API call failed: HTTP " + response.statusCode() + " - " + response.body());
        }

        return gson.fromJson(response.body(), ChatCompletionResponse.class);
    }

    /**
     * Test the authentication implementation
     */
    public static boolean testAuthentication() {
        System.out.println("=== Gloo AI Authentication Test ===\n");

        try {
            // Test 1: Verify API key is configured
            System.out.println("1. Verifying API key is configured...");
            if (!validateCredentials()) {
                return false;
            }
            System.out.println("   API key is set\n");

            // Test 2: API call with authentication
            System.out.println("2. Testing authenticated API call...");
            ChatCompletionRequest request = new ChatCompletionRequest(
                true,
                List.of(new ChatMessage("user", "Hello! This is a test of the authentication system."))
            );

            ChatCompletionResponse result = makeAuthenticatedRequest(API_URL, request);

            System.out.println("   API call successful");
            String content = result.choices.get(0).message.content;
            if (content.length() > 100) {
                content = content.substring(0, 100) + "...";
            }
            System.out.println("   Response: " + content + "\n");

            System.out.println("=== All tests passed! ===");
            return true;

        } catch (Exception e) {
            System.err.println("Authentication test failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * Main method - entry point
     */
    public static void main(String[] args) {
        if (!validateCredentials()) {
            return;
        }

        testAuthentication();
    }
}
