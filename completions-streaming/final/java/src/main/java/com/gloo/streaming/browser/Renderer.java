package com.gloo.streaming.browser;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.gloo.streaming.streaming.StreamClient;

/**
 * CLI typing-effect renderer for streaming completions.
 *
 * <p>Writes each token to {@code System.out} without newlines as it arrives,
 * creating a real-time typing effect in the terminal.
 */
public class Renderer {

    /**
     * Stream a completion and print tokens to stdout with a typing effect.
     *
     * <p>Uses {@link System#out#print} (no newline) and {@link System#out#flush}
     * after each token so the user sees text appear token-by-token.
     *
     * @param message The user message to send
     * @param token   Valid Bearer token for authorization
     */
    @SuppressWarnings("unchecked")
    public static void renderStreamToTerminal(String message, String token) {
        System.out.print("Prompt: " + message + "\n\nResponse: ");
        System.out.flush();

        HttpResponse<java.io.InputStream> response = StreamClient.makeStreamingRequest(message, token);

        int totalTokens = 0;
        String finishReason = "unknown";

        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(response.body(), StandardCharsets.UTF_8)
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                Object parsed = StreamClient.parseSseLine(line);
                if (parsed == null) continue;
                if ("[DONE]".equals(parsed)) break;

                Map<String, Object> chunk = (Map<String, Object>) parsed;
                String content = StreamClient.extractTokenContent(chunk);
                if (!content.isEmpty()) {
                    System.out.print(content);
                    System.out.flush();
                    totalTokens++;
                }

                List<Map<String, Object>> choices =
                    (List<Map<String, Object>>) chunk.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Object fr = choices.get(0).get("finish_reason");
                    if (fr != null && !fr.toString().equals("null")) {
                        finishReason = fr.toString();
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error reading stream: " + e.getMessage());
        }

        System.out.println("\n\n[" + totalTokens + " tokens, finish_reason=" + finishReason + "]");
    }
}
