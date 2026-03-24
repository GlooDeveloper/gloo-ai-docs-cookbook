package com.gloo.streaming.tests;

import com.gloo.streaming.auth.TokenManager;
import com.gloo.streaming.streaming.StreamClient;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Streaming Request & SSE Line Parsing Test
 *
 * <p>Validates that:
 * <ul>
 *   <li>makeStreamingRequest() opens a streaming connection</li>
 *   <li>parseSseLine() correctly parses data lines, blank lines, and [DONE]</li>
 * </ul>
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step2SseParsingTest
 */
public class Step2SseParsingTest {

    public static void main(String[] args) {
        System.out.println("🧪 Testing: Streaming Request & SSE Line Parsing\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        if (dotenv.get("GLOO_CLIENT_ID", "").isBlank()) {
            System.err.println("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
            System.exit(1);
        }

        try {
            String token = TokenManager.ensureValidToken();
            System.out.println("✓ Token obtained\n");

            // Test 1: parseSseLine — blank line
            System.out.println("Test 1: parseSseLine — blank line...");
            Object result = StreamClient.parseSseLine("");
            if (result != null) throw new RuntimeException("Expected null for blank line, got: " + result);
            System.out.println("✓ Blank line → null");

            // Test 2: parseSseLine — non-data line
            System.out.println("Test 2: parseSseLine — non-data line...");
            result = StreamClient.parseSseLine("event: message");
            if (result != null) throw new RuntimeException("Expected null for non-data line, got: " + result);
            System.out.println("✓ Non-data line → null");

            // Test 3: parseSseLine — [DONE] sentinel
            System.out.println("Test 3: parseSseLine — [DONE] sentinel...");
            result = StreamClient.parseSseLine("data: [DONE]");
            if (!"[DONE]".equals(result)) throw new RuntimeException("Expected '[DONE]', got: " + result);
            System.out.println("✓ data: [DONE] → \"[DONE]\"");

            // Test 4: parseSseLine — valid JSON data line
            System.out.println("Test 4: parseSseLine — valid JSON data line...");
            String sample = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"},\"finish_reason\":null}]}";
            result = StreamClient.parseSseLine(sample);
            if (!(result instanceof Map)) throw new RuntimeException("Expected Map, got: " + (result == null ? "null" : result.getClass()));
            @SuppressWarnings("unchecked")
            Map<String, Object> chunk = (Map<String, Object>) result;
            @SuppressWarnings("unchecked")
            var choices = (java.util.List<Map<String, Object>>) chunk.get("choices");
            @SuppressWarnings("unchecked")
            var delta = (Map<String, Object>) choices.get(0).get("delta");
            if (!"Hello".equals(delta.get("content"))) throw new RuntimeException("Unexpected content value");
            System.out.println("✓ data: {json} → parsed Map");

            // Test 5: parseSseLine — malformed JSON
            System.out.println("Test 5: parseSseLine — malformed JSON...");
            result = StreamClient.parseSseLine("data: {broken json");
            if (result != null) throw new RuntimeException("Expected null for malformed JSON, got: " + result);
            System.out.println("✓ Malformed JSON → null (gracefully handled)\n");

            // Test 6: Live streaming connection
            System.out.println("Test 6: makeStreamingRequest() — live connection...");
            HttpResponse<java.io.InputStream> response = StreamClient.makeStreamingRequest(
                "Say exactly: 'Stream test OK'", token
            );
            if (response.statusCode() != 200) {
                throw new RuntimeException("Expected 200, got " + response.statusCode());
            }
            System.out.println("✓ Streaming connection opened (status 200)");

            // Test 7: Iterate lines and detect stream termination via finish_reason
            System.out.println("Test 7: Iterating SSE lines and detecting stream termination...");
            int linesProcessed = 0, dataChunks = 0;
            boolean streamTerminated = false;
            String finishReason = null;

            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.body(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    linesProcessed++;
                    Object parsed = StreamClient.parseSseLine(line);
                    if (parsed instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> chunkMap = (Map<String, Object>) parsed;
                        @SuppressWarnings("unchecked")
                        var lineChoices = (java.util.List<Map<String, Object>>) chunkMap.get("choices");
                        if (lineChoices != null && !lineChoices.isEmpty()) {
                            Object reason = lineChoices.get(0).get("finish_reason");
                            if (reason != null) {
                                streamTerminated = true;
                                finishReason = reason.toString();
                                break;
                            }
                        }
                        dataChunks++;
                    }
                }
            }

            System.out.printf("✓ Processed %d lines, %d data chunks%n", linesProcessed, dataChunks);

            if (!streamTerminated) {
                System.out.println("⚠️  Stream ended without a finish_reason chunk");
            } else {
                System.out.println("✓ Stream terminated cleanly (finish_reason=" + finishReason + ")");
            }

            System.out.println("\n✅ Streaming request and SSE parsing working.");
            System.out.println("   Next: Extracting Token Content\n");

        } catch (Exception e) {
            System.err.println("\n❌ Streaming Request & SSE Parsing Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - Check makeStreamingRequest() sets stream:true in the payload");
            System.err.println("   - Check parseSseLine() strips 'data: ' prefix (substring(6))");
            System.err.println("   - Verify [DONE] check: data.trim().equals(\"[DONE]\")\n");
            System.exit(1);
        }
    }
}
