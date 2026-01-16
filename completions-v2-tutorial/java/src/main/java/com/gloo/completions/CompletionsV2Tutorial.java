package com.gloo.completions;

import com.google.gson.Gson;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gloo AI Completions V2 Tutorial - Java
 *
 * This example demonstrates how to use the Gloo AI Completions V2 API
 * with its three routing strategies: auto-routing, model family selection,
 * and direct model selection.
 */
public class CompletionsV2Tutorial {

    // Configuration
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    private final String clientId;
    private final String clientSecret;
    private TokenInfo tokenInfo;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Gson gson = new Gson();

    // Token info class
    private static class TokenInfo {
        String access_token;
        int expires_in;
        long expires_at;
    }

    public CompletionsV2Tutorial(String clientId, String clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Retrieve a new access token from the Gloo AI API
     */
    private void fetchAccessToken() throws IOException, InterruptedException {
        String auth = clientId + ":" + clientSecret;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        String requestBody = "grant_type=client_credentials&scope=api/access";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Failed to get token: " + response.body());
        }

        this.tokenInfo = gson.fromJson(response.body(), TokenInfo.class);
        this.tokenInfo.expires_at = Instant.now().getEpochSecond() + this.tokenInfo.expires_in;
    }

    /**
     * Check if the token is expired or close to expiring
     */
    private boolean isTokenExpired() {
        if (this.tokenInfo == null || this.tokenInfo.expires_at == 0) {
            return true;
        }
        return Instant.now().getEpochSecond() > (this.tokenInfo.expires_at - 60);
    }

    /**
     * Ensure we have a valid access token
     */
    private void ensureValidToken() throws IOException, InterruptedException {
        if (isTokenExpired()) {
            System.out.println("Getting new access token...");
            fetchAccessToken();
        }
    }

    /**
     * Make an API request
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> makeRequest(String payload) throws IOException, InterruptedException {
        ensureValidToken();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + this.tokenInfo.access_token)
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("API call failed: " + response.body());
        }

        return gson.fromJson(response.body(), Map.class);
    }

    /**
     * Example 1: Auto-routing - Let Gloo AI select the optimal model
     */
    public Map<String, Object> makeV2AutoRouting(String message, String tradition) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> messageEntry = new HashMap<>();
        messageEntry.put("role", "user");
        messageEntry.put("content", message);
        payload.put("messages", List.of(messageEntry));
        payload.put("auto_routing", true);
        payload.put("tradition", tradition);
        return makeRequest(gson.toJson(payload));
    }

    /**
     * Example 2: Model family selection - Choose a provider family
     */
    public Map<String, Object> makeV2ModelFamily(String message, String modelFamily) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> messageEntry = new HashMap<>();
        messageEntry.put("role", "user");
        messageEntry.put("content", message);
        payload.put("messages", List.of(messageEntry));
        payload.put("model_family", modelFamily);
        return makeRequest(gson.toJson(payload));
    }

    /**
     * Example 3: Direct model selection - Specify an exact model
     */
    public Map<String, Object> makeV2DirectModel(String message, String model) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> messageEntry = new HashMap<>();
        messageEntry.put("role", "user");
        messageEntry.put("content", message);
        payload.put("messages", List.of(messageEntry));
        payload.put("model", model);
        payload.put("temperature", 0.7);
        payload.put("max_tokens", 500);
        return makeRequest(gson.toJson(payload));
    }

    /**
     * Get response content from result
     */
    @SuppressWarnings("unchecked")
    private String getResponseContent(Map<String, Object> result) {
        List<Map<String, Object>> choices = (List<Map<String, Object>>) result.get("choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        String content = (String) message.get("content");
        return content.length() > 100 ? content.substring(0, 100) + "..." : content;
    }

    /**
     * Test the Completions V2 API with all three routing strategies
     */
    public boolean testCompletionsV2API() {
        System.out.println("=== Gloo AI Completions V2 API Test ===\n");

        try {
            // Example 1: Auto-routing
            System.out.println("Example 1: Auto-Routing");
            System.out.println("Testing: How does the Old Testament connect to the New Testament?");
            Map<String, Object> result1 = makeV2AutoRouting(
                "How does the Old Testament connect to the New Testament?", "evangelical");
            System.out.println("   Model used: " + result1.get("model"));
            System.out.println("   Routing: " + result1.get("routing_mechanism"));
            System.out.println("   Response: " + getResponseContent(result1));
            System.out.println("   ✓ Auto-routing test passed\n");

            // Example 2: Model family selection
            System.out.println("Example 2: Model Family Selection");
            System.out.println("Testing: Draft a short sermon outline on forgiveness.");
            Map<String, Object> result2 = makeV2ModelFamily(
                "Draft a short sermon outline on forgiveness.", "anthropic");
            System.out.println("   Model used: " + result2.get("model"));
            System.out.println("   Response: " + getResponseContent(result2));
            System.out.println("   ✓ Model family test passed\n");

            // Example 3: Direct model selection
            System.out.println("Example 3: Direct Model Selection");
            System.out.println("Testing: Summarize the book of Romans in 3 sentences.");
            Map<String, Object> result3 = makeV2DirectModel(
                "Summarize the book of Romans in 3 sentences.", "gloo-anthropic-claude-sonnet-4.5");
            System.out.println("   Model used: " + result3.get("model"));
            System.out.println("   Response: " + getResponseContent(result3));
            System.out.println("   ✓ Direct model test passed\n");

            System.out.println("=== All Completions V2 tests passed! ===");
            return true;

        } catch (Exception e) {
            System.out.println("✗ Test failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Main entry point
     */
    public static void main(String[] args) {
        // Load environment variables
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

        String clientId = dotenv.get("GLOO_CLIENT_ID", System.getenv().getOrDefault("GLOO_CLIENT_ID", "YOUR_CLIENT_ID"));
        String clientSecret = dotenv.get("GLOO_CLIENT_SECRET", System.getenv().getOrDefault("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET"));

        if (clientId.equals("YOUR_CLIENT_ID") || clientSecret.equals("YOUR_CLIENT_SECRET")) {
            System.out.println("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
            System.out.println("You can create a .env file with:");
            System.out.println("GLOO_CLIENT_ID=your_client_id");
            System.out.println("GLOO_CLIENT_SECRET=your_client_secret");
            return;
        }

        CompletionsV2Tutorial tutorial = new CompletionsV2Tutorial(clientId, clientSecret);
        tutorial.testCompletionsV2API();
    }
}
