package com.gloo.streaming.tests;

import com.gloo.streaming.auth.TokenManager;
import io.github.cdimascio.dotenv.Dotenv;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

/**
 * Environment Setup & Auth Verification Test
 *
 * <p>Validates that credentials load correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step1AuthTest
 */
public class Step1AuthTest {

    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    public static void main(String[] args) {
        System.out.println("🧪 Testing: Environment Setup & Auth Verification\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        String clientId = dotenv.get("GLOO_CLIENT_ID", "");
        String clientSecret = dotenv.get("GLOO_CLIENT_SECRET", "");

        if (clientId.isBlank() || clientSecret.isBlank()) {
            System.err.println("❌ Missing required environment variables");
            System.err.println("   Make sure .env file contains:");
            System.err.println("   - GLOO_CLIENT_ID");
            System.err.println("   - GLOO_CLIENT_SECRET");
            System.exit(1);
        }

        System.out.println("✓ GLOO_CLIENT_ID loaded");
        System.out.println("✓ GLOO_CLIENT_SECRET loaded\n");

        try {
            // Test 1: Get access token
            System.out.println("Test 1: Obtaining access token...");
            Map<String, Object> tokenData = TokenManager.getAccessToken();

            if (!tokenData.containsKey("access_token")) {
                throw new RuntimeException("Token response missing access_token field");
            }

            System.out.println("✓ Access token obtained");
            Object expiresIn = tokenData.get("expires_in");
            System.out.println("  Expires in: " + (expiresIn != null ? ((Number) expiresIn).intValue() : "N/A") + " seconds");

            // Test 2: ensureValidToken caches correctly
            System.out.println("\nTest 2: Token caching (ensureValidToken)...");
            String token1 = TokenManager.ensureValidToken();
            String token2 = TokenManager.ensureValidToken();

            if (!token1.equals(token2)) {
                throw new RuntimeException("ensureValidToken returned different tokens on consecutive calls");
            }

            System.out.println("✓ Token cached correctly — same token returned on consecutive calls");

            // Test 3: Verify streaming endpoint returns 200 + text/event-stream
            System.out.println("\nTest 3: Verifying streaming endpoint...");

            String payload = "{\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}],\"auto_routing\":true,\"stream\":true}";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Authorization", "Bearer " + token1)
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
            System.err.println("   - Check that .env has valid GLOO_CLIENT_ID and GLOO_CLIENT_SECRET");
            System.err.println("   - Verify credentials at https://platform.ai.gloo.com/studio/manage-api-credentials");
            System.err.println("   - Ensure you have internet connectivity\n");
            System.exit(1);
        }
    }
}
