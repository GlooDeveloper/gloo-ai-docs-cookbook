package com.gloo.grounded;

import com.google.gson.*;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Grounded Completions Recipe - Java Implementation
 *
 * This class demonstrates the difference between non-grounded and grounded
 * completions using Gloo AI's RAG (Retrieval-Augmented Generation) capabilities.
 *
 * It compares responses from a standard completion (which may hallucinate)
 * against a grounded completion (which uses your actual content).
 */
public class GroundedCompletionsRecipe {

    // Configuration
    private static String glooClientId;
    private static String glooClientSecret;
    private static String publisherName;

    // API Endpoints
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    private static final String GROUNDED_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions/grounded";

    // Token management
    private static String accessToken = null;
    private static Instant tokenExpiry = null;

    // HTTP Client
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // JSON Parser
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    /**
     * Retrieve an OAuth2 access token from Gloo AI.
     *
     * @return Token response containing access_token and expires_in
     * @throws Exception If credentials are missing or request fails
     */
    private static JsonObject getAccessToken() throws Exception {
        if (glooClientId == null || glooClientSecret == null ||
            glooClientId.isEmpty() || glooClientSecret.isEmpty()) {
            throw new Exception(
                "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET " +
                "environment variables."
            );
        }

        String formData = String.format(
            "grant_type=client_credentials&client_id=%s&client_secret=%s",
            glooClientId, glooClientSecret
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formData))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Failed to get access token. HTTP " + response.statusCode());
        }

        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    /**
     * Ensure we have a valid access token, refreshing if necessary.
     *
     * @return Valid access token
     * @throws Exception If token retrieval fails
     */
    private static String ensureValidToken() throws Exception {
        // Check if we need a new token
        if (accessToken == null || tokenExpiry == null || Instant.now().isAfter(tokenExpiry)) {
            JsonObject tokenData = getAccessToken();
            accessToken = tokenData.get("access_token").getAsString();

            // Set expiry with 5 minute buffer
            int expiresIn = tokenData.has("expires_in") ?
                    tokenData.get("expires_in").getAsInt() : 3600;
            tokenExpiry = Instant.now().plusSeconds(expiresIn - 300);
        }

        return accessToken;
    }

    /**
     * Make a standard V2 completion request WITHOUT grounding.
     *
     * This uses the model's general knowledge and may produce generic
     * or potentially inaccurate responses about your specific content.
     *
     * @param query The user's question
     * @return API response
     * @throws Exception If request fails
     */
    private static JsonObject makeNonGroundedRequest(String query) throws Exception {
        String token = ensureValidToken();

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", query);

        JsonArray messages = new JsonArray();
        messages.add(message);

        JsonObject payload = new JsonObject();
        payload.add("messages", messages);
        payload.addProperty("auto_routing", true);
        payload.addProperty("max_tokens", 500);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(COMPLETIONS_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Non-grounded request failed. HTTP " + response.statusCode());
        }

        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    /**
     * Make a grounded completion request using Gloo's default dataset.
     *
     * @param query The user's question
     * @param sourcesLimit Maximum number of sources to use
     * @return API response with sources_returned flag
     * @throws Exception If request fails
     */
    private static JsonObject makeDefaultGroundedRequest(String query, int sourcesLimit) throws Exception {
        String token = ensureValidToken();

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", query);

        JsonArray messages = new JsonArray();
        messages.add(message);

        JsonObject payload = new JsonObject();
        payload.add("messages", messages);
        payload.addProperty("auto_routing", true);
        payload.addProperty("sources_limit", sourcesLimit);
        payload.addProperty("max_tokens", 500);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GROUNDED_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Default grounded request failed. HTTP " + response.statusCode());
        }

        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    /**
     * Make a grounded completion request WITH RAG on your specific publisher.
     *
     * @param query The user's question
     * @param publisherName Name of the publisher in Gloo Studio
     * @param sourcesLimit Maximum number of sources to use
     * @return API response with sources_returned flag
     * @throws Exception If request fails
     */
    private static JsonObject makePublisherGroundedRequest(String query, String publisherName,
                                                   int sourcesLimit) throws Exception {
        String token = ensureValidToken();

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", query);

        JsonArray messages = new JsonArray();
        messages.add(message);

        JsonObject payload = new JsonObject();
        payload.add("messages", messages);
        payload.addProperty("auto_routing", true);
        payload.addProperty("rag_publisher", publisherName);
        payload.addProperty("sources_limit", sourcesLimit);
        payload.addProperty("max_tokens", 500);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GROUNDED_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Publisher grounded request failed. HTTP " + response.statusCode());
        }

        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    /**
     * Compare non-grounded vs default grounded vs publisher grounded responses.
     *
     * @param query The question to ask
     * @param publisherName Name of the publisher in Gloo Studio
     */
    private static void compareResponses(String query, String publisherName) {
        System.out.println("\n" + "=".repeat(80));
        System.out.println("Query: " + query);
        System.out.println("=".repeat(80));

        // Step 1: Non-grounded
        System.out.println("\n🔹 STEP 1: NON-GROUNDED Response (Generic Model Knowledge):");
        System.out.println("-".repeat(80));
        try {
            JsonObject nonGrounded = makeNonGroundedRequest(query);
            String content = nonGrounded.getAsJsonArray("choices")
                    .get(0).getAsJsonObject()
                    .getAsJsonObject("message")
                    .get("content").getAsString();
            System.out.println(content);

            System.out.println("\n📊 Metadata:");
            boolean sourcesUsed = nonGrounded.has("sources_returned") &&
                    nonGrounded.get("sources_returned").getAsBoolean();
            System.out.println("   Sources used: " + sourcesUsed);
            String model = nonGrounded.has("model") ?
                    nonGrounded.get("model").getAsString() : "N/A";
            System.out.println("   Model: " + model);
        } catch (Exception e) {
            System.out.println("❌ Error: " + e.getMessage());
        }

        System.out.println("\n" + "=".repeat(80) + "\n");

        // Step 2: Default grounded
        System.out.println("🔹 STEP 2: GROUNDED on Default Dataset (Gloo's Faith-Based Content):");
        System.out.println("-".repeat(80));
        try {
            JsonObject defaultGrounded = makeDefaultGroundedRequest(query, 3);
            String content = defaultGrounded.getAsJsonArray("choices")
                    .get(0).getAsJsonObject()
                    .getAsJsonObject("message")
                    .get("content").getAsString();
            System.out.println(content);

            System.out.println("\n📊 Metadata:");
            boolean sourcesUsed = defaultGrounded.has("sources_returned") &&
                    defaultGrounded.get("sources_returned").getAsBoolean();
            System.out.println("   Sources used: " + sourcesUsed);
            String model = defaultGrounded.has("model") ?
                    defaultGrounded.get("model").getAsString() : "N/A";
            System.out.println("   Model: " + model);
        } catch (Exception e) {
            System.out.println("❌ Error: " + e.getMessage());
        }

        System.out.println("\n" + "=".repeat(80) + "\n");

        // Step 3: Publisher grounded
        System.out.println("🔹 STEP 3: GROUNDED on Your Publisher (Your Specific Content):");
        System.out.println("-".repeat(80));
        try {
            JsonObject publisherGrounded = makePublisherGroundedRequest(query, publisherName, 3);
            String content = publisherGrounded.getAsJsonArray("choices")
                    .get(0).getAsJsonObject()
                    .getAsJsonObject("message")
                    .get("content").getAsString();
            System.out.println(content);

            System.out.println("\n📊 Metadata:");
            boolean sourcesUsed = publisherGrounded.has("sources_returned") &&
                    publisherGrounded.get("sources_returned").getAsBoolean();
            System.out.println("   Sources used: " + sourcesUsed);
            String model = publisherGrounded.has("model") ?
                    publisherGrounded.get("model").getAsString() : "N/A";
            System.out.println("   Model: " + model);
        } catch (Exception e) {
            System.out.println("❌ Error: " + e.getMessage());
        }

        System.out.println("\n" + "=".repeat(80) + "\n");
    }

    /**
     * Prompt user for input.
     */
    private static void promptToContinue() {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            System.out.print("Press Enter to continue to next comparison...");
            reader.readLine();
        } catch (IOException e) {
            // Ignore
        }
    }

    /**
     * Run the grounded completions comparison demo.
     *
     * Tests multiple queries to demonstrate the value of RAG in reducing
     * hallucinations and providing accurate, source-backed responses.
     */
    public static void main(String[] args) {
        // Load environment variables
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()
                .load();

        glooClientId = dotenv.get("GLOO_CLIENT_ID");
        glooClientSecret = dotenv.get("GLOO_CLIENT_SECRET");
        publisherName = dotenv.get("PUBLISHER_NAME", "Bezalel");

        System.out.println("\n" + "=".repeat(80));
        System.out.println("  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses");
        System.out.println("=".repeat(80));
        System.out.println("\nPublisher: " + publisherName);
        System.out.println("This demo shows a 3-step progression:");
        System.out.println("  1. Non-grounded (generic model knowledge)");
        System.out.println("  2. Grounded on default dataset (Gloo's faith-based content)");
        System.out.println("  3. Grounded on your publisher (your specific content)");
        System.out.println("\nNote: For org-specific queries like Bezalel's hiring process,");
        System.out.println("both steps 1 and 2 may lack specific details, while step 3");
        System.out.println("provides accurate, source-backed answers from your content.\n");

        // Test queries that demonstrate clear differences
        String[] queries = {
            "What is Bezalel Ministries' hiring process?",
            "What educational resources does Bezalel Ministries provide?",
            "Describe Bezalel's research methodology for creating artwork."
        };

        for (int i = 0; i < queries.length; i++) {
            System.out.println("\n" + "#".repeat(80));
            System.out.println("# COMPARISON " + (i + 1) + " of " + queries.length);
            System.out.println("#".repeat(80));

            compareResponses(queries[i], publisherName);

            // Pause between comparisons for readability
            if (i < queries.length - 1) {
                promptToContinue();
            }
        }

        System.out.println("\n" + "=".repeat(80));
        System.out.println("  Demo Complete!");
        System.out.println("=".repeat(80));
        System.out.println("\nKey Takeaways:");
        System.out.println("✓ Step 1 (Non-grounded): Generic model knowledge, may hallucinate");
        System.out.println("✓ Step 2 (Default grounded): Uses Gloo's faith-based content, better for");
        System.out.println("  general questions but lacks org-specific details");
        System.out.println("✓ Step 3 (Publisher grounded): Your specific content, accurate and");
        System.out.println("  source-backed (sources_returned: true)");
        System.out.println("✓ Grounding on relevant content is key - generic grounding may not help");
        System.out.println("  for organization-specific queries");
        System.out.println("\nNext Steps:");
        System.out.println("• Upload your own content to a Publisher in Gloo Studio");
        System.out.println("• Update PUBLISHER_NAME in .env to use your content");
        System.out.println("• Try both general and specific queries to see the differences!");
        System.out.println();
    }
}
