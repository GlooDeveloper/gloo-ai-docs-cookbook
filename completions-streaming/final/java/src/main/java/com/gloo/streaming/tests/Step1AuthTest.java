package com.gloo.streaming.tests;

import io.github.cdimascio.dotenv.Dotenv;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Environment Setup & Auth Verification Test
 *
 * <p>Validates that the API key loads correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step1AuthTest
 */
public class Step1AuthTest {

    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    public static void main(String[] args) {
        System.out.println("🧪 Testing: Environment Setup & Auth Verification\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        String apiKey = dotenv.get("GLOO_API_KEY", "");

        if (apiKey.isBlank()) {
            System.err.println("❌ Missing required environment variables");
            System.err.println("   Make sure .env file contains:");
            System.err.println("   - GLOO_API_KEY");
            System.exit(1);
        }

        System.out.println("✓ API key loaded\n");

        try {
            // Test 1: Verify streaming endpoint returns 200 + text/event-stream
            System.out.println("Test 1: Verifying streaming endpoint...");

            String payload = "{\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}],\"auto_routing\":true,\"stream\":true}";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

            HttpResponse<java.io.InputStream> response = HttpClient.newHttpClient().send(
                request, HttpResponse.BodyHandlers.ofInputStream()
            );
            response.body().transferTo(java.io.OutputStream.nullOutputStream());

            if (response.statusCode() != 200) {
                throw new RuntimeException("Expected 200, got " + response.statusCode());
            }

            String contentType = response.headers().firstValue("content-type").orElse("");
            if (!contentType.contains("text/event-stream")) {
                throw new RuntimeException("Expected Content-Type: text/event-stream, got: " + contentType);
            }

            System.out.println("✓ Status: 200 OK");
            System.out.println("✓ Content-Type: " + contentType);

            System.out.println("\n✅ Auth and streaming endpoint verified.");
            System.out.println("   Next: Making the Streaming Request\n");

        } catch (Exception e) {
            System.err.println("\n❌ Auth Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - Check that .env has a valid GLOO_API_KEY");
            System.err.println("   - Verify credentials at https://studio.ai.gloo.com/api-keys");
            System.err.println("   - Ensure you have internet connectivity\n");
            System.exit(1);
        }
    }
}
