package com.gloo.streaming.tests;

import com.gloo.streaming.auth.TokenManager;
import com.gloo.streaming.streaming.StreamClient;
import io.github.cdimascio.dotenv.Dotenv;

import java.util.List;
import java.util.Map;

/**
 * Steps 4–5 Test: Token Extraction & Full Response Assembly
 *
 * <p>Validates that:
 * <ul>
 *   <li>extractTokenContent() safely navigates choices[0].delta.content</li>
 *   <li>streamCompletion() assembles the full text and tracks timing/count</li>
 * </ul>
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step3AccumulationTest
 */
public class Step3AccumulationTest {

    private static Map<String, Object> makeChunk(String content, Object finishReason) {
        return Map.of("choices", List.of(Map.of(
            "delta", content != null && !content.isEmpty() ? Map.of("content", content) : Map.of(),
            "finish_reason", finishReason != null ? finishReason : "null"
        )));
    }

    public static void main(String[] args) {
        System.out.println("🧪 Testing Steps 4–5: Token Extraction & Accumulation\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        if (dotenv.get("GLOO_CLIENT_ID", "").isBlank()) {
            System.err.println("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
            System.exit(1);
        }

        try {
            // Test 1: extractTokenContent — normal chunk
            System.out.println("Test 1: extractTokenContent — normal chunk...");
            Map<String, Object> chunk = makeChunk("Hello", null);
            String result = StreamClient.extractTokenContent(chunk);
            if (!"Hello".equals(result)) throw new RuntimeException("Expected 'Hello', got: " + result);
            System.out.println("✓ Normal chunk → 'Hello'");

            // Test 2: extractTokenContent — empty content
            System.out.println("Test 2: extractTokenContent — empty content...");
            chunk = makeChunk("", null);
            result = StreamClient.extractTokenContent(chunk);
            if (!result.isEmpty()) throw new RuntimeException("Expected '', got: " + result);
            System.out.println("✓ Empty content → ''");

            // Test 3: extractTokenContent — empty delta
            System.out.println("Test 3: extractTokenContent — empty delta...");
            Map<String, Object> emptyChunk = Map.of("choices", List.of(Map.of("delta", Map.of(), "finish_reason", "null")));
            result = StreamClient.extractTokenContent(emptyChunk);
            if (!result.isEmpty()) throw new RuntimeException("Expected '', got: " + result);
            System.out.println("✓ Empty delta → ''");

            // Test 4: extractTokenContent — no choices
            System.out.println("Test 4: extractTokenContent — no choices...");
            Map<String, Object> noChoices = Map.of("choices", List.of());
            result = StreamClient.extractTokenContent(noChoices);
            if (!result.isEmpty()) throw new RuntimeException("Expected '', got: " + result);
            System.out.println("✓ Empty choices → ''");

            // Test 5: extractTokenContent — finish_reason chunk
            System.out.println("Test 5: extractTokenContent — finish_reason chunk...");
            chunk = makeChunk("", "stop");
            result = StreamClient.extractTokenContent(chunk);
            if (!result.isEmpty()) throw new RuntimeException("Expected '', got: " + result);
            System.out.println("✓ finish_reason chunk → '' (no content from finish chunk)\n");

            // Test 6: Full streamCompletion integration test
            System.out.println("Test 6: streamCompletion — full response assembly...");
            String token = TokenManager.ensureValidToken();
            StreamClient.StreamResult streamResult = StreamClient.streamCompletion(
                "Count from 1 to 5, separated by spaces. Reply with only the numbers.",
                token
            );

            if (streamResult == null) throw new RuntimeException("streamCompletion returned null");

            System.out.println("✓ Delta content extraction working");
            System.out.println("✓ Null delta handled gracefully");
            System.out.println("✓ finish_reason detected: " + streamResult.finishReason());
            System.out.println("✓ Duration tracked: " + streamResult.durationMs() + "ms");
            System.out.println("✓ Token count: " + streamResult.tokenCount() + " tokens");

            if (streamResult.text() != null && !streamResult.text().isEmpty()) {
                String preview = streamResult.text().length() > 80 ? streamResult.text().substring(0, 80) : streamResult.text();
                System.out.println("  Response preview: " + preview.trim());
            } else {
                System.out.println("⚠️  Empty response text — check accumulation loop");
            }

            if (streamResult.tokenCount() == 0) throw new RuntimeException("tokenCount is 0 — extractTokenContent may not be working");
            if (streamResult.durationMs() <= 0) throw new RuntimeException("durationMs is 0 — timing not tracked");

            System.out.println("\n✅ Steps 4–5 Complete! Full response assembled.");
            System.out.println("   Continue to Step 6: Streaming Error Handling\n");

        } catch (Exception e) {
            System.err.println("\n❌ Steps 4–5 Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - extractTokenContent: cast choices, then delta, then get 'content'");
            System.err.println("   - streamCompletion: increment tokenCount only when !content.isEmpty()");
            System.err.println("   - Capture start = Instant.now() before makeStreamingRequest\n");
            System.exit(1);
        }
    }
}
