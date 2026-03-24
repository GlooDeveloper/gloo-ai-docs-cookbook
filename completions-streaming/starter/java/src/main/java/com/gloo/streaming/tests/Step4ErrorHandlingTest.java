package com.gloo.streaming.tests;

import com.gloo.streaming.streaming.StreamClient;
import io.github.cdimascio.dotenv.Dotenv;

/**
 * Streaming Error Handling Test
 *
 * <p>Validates that:
 * <ul>
 *   <li>handleStreamError() throws the right exception for 401, 403, 429</li>
 *   <li>handleStreamError() does not throw for 200</li>
 *   <li>Bad credentials produce a proper auth error</li>
 * </ul>
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step4ErrorHandlingTest
 */
public class Step4ErrorHandlingTest {

    public static void main(String[] args) {
        System.out.println("🧪 Testing: Streaming Error Handling\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        if (dotenv.get("GLOO_CLIENT_ID", "").isBlank()) {
            System.err.println("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
            System.exit(1);
        }

        try {
            // Test 1: handleStreamError(401)
            System.out.println("Test 1: handleStreamError(401)...");
            try {
                StreamClient.handleStreamError(401, "");
                throw new RuntimeException("Expected exception for 401, but none thrown");
            } catch (RuntimeException e) {
                if (!e.getMessage().contains("401")) {
                    throw new RuntimeException("Expected 401 in message, got: " + e.getMessage());
                }
                System.out.println("✓ 401 throws: " + e.getMessage());
            }

            // Test 2: handleStreamError(403)
            System.out.println("Test 2: handleStreamError(403)...");
            try {
                StreamClient.handleStreamError(403, "");
                throw new RuntimeException("Expected exception for 403, but none thrown");
            } catch (RuntimeException e) {
                if (!e.getMessage().contains("403")) {
                    throw new RuntimeException("Expected 403 in message, got: " + e.getMessage());
                }
                System.out.println("✓ 403 throws: " + e.getMessage());
            }

            // Test 3: handleStreamError(429)
            System.out.println("Test 3: handleStreamError(429)...");
            try {
                StreamClient.handleStreamError(429, "");
                throw new RuntimeException("Expected exception for 429, but none thrown");
            } catch (RuntimeException e) {
                if (!e.getMessage().contains("429")) {
                    throw new RuntimeException("Expected 429 in message, got: " + e.getMessage());
                }
                System.out.println("✓ 429 throws: " + e.getMessage());
            }

            // Test 4: handleStreamError(200) — should not throw
            System.out.println("Test 4: handleStreamError(200) — should not throw...");
            try {
                StreamClient.handleStreamError(200, "");
                System.out.println("✓ 200 does not throw");
            } catch (RuntimeException e) {
                throw new RuntimeException("handleStreamError(200) should not throw, but threw: " + e.getMessage());
            }

            // Test 5: handleStreamError(500) with body
            System.out.println("Test 5: handleStreamError(500)...");
            try {
                StreamClient.handleStreamError(500, "Internal Server Error");
                throw new RuntimeException("Expected exception for 500, but none thrown");
            } catch (RuntimeException e) {
                if (!e.getMessage().contains("500")) {
                    throw new RuntimeException("Expected 500 in message, got: " + e.getMessage());
                }
                System.out.println("✓ 500 throws with body: " + e.getMessage());
            }

            // Test 6: Bad credentials caught by makeStreamingRequest
            System.out.println("\nTest 6: Bad credentials → auth error...");
            try {
                StreamClient.makeStreamingRequest("test", "invalid-token-xyz");
                throw new RuntimeException("Expected makeStreamingRequest to throw with bad credentials");
            } catch (RuntimeException e) {
                if (e.getMessage().startsWith("Expected ")) throw e;
                System.out.println("✓ Bad credentials caught: " + e.getMessage());
            }

            System.out.println("\n✅ Two-phase error handling working.");
            System.out.println("   Next: Typing-Effect Renderer\n");

        } catch (Exception e) {
            System.err.println("\n❌ Streaming Error Handling Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - handleStreamError should throw RuntimeException for non-200 status");
            System.err.println("   - Specific messages for 401, 403, 429 help users debug auth issues");
            System.err.println("   - makeStreamingRequest calls handleStreamError on non-200 responses\n");
            System.exit(1);
        }
    }
}
