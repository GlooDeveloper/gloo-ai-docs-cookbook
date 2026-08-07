package com.gloo.streaming;

import com.gloo.streaming.browser.Renderer;
import com.gloo.streaming.streaming.StreamClient;
import io.github.cdimascio.dotenv.Dotenv;

/**
 * Streaming AI Responses in Real Time - Java Entry Point.
 *
 * <p>Demonstrates SSE-based streaming from the Gloo AI completions API.
 * Shows token accumulation and typing-effect rendering.
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("Streaming AI Responses in Real Time\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        String apiKey = dotenv.get("GLOO_API_KEY", "");

        if (apiKey.isBlank()) {
            System.err.println("Missing credentials. Set GLOO_API_KEY");
            System.exit(1);
        }

        System.out.println("Environment variables loaded\n");

        // --- Example 1: Accumulate full response ---
        System.out.println("Example: Streaming a completion (accumulate full text)...");
        String token = apiKey;
        StreamClient.StreamResult result = StreamClient.streamCompletion(
            "What is the significance of the resurrection?",
            token
        );
        System.out.println("\nFull response:\n" + result.text());
        System.out.printf("\nReceived %d tokens in %dms%n", result.tokenCount(), result.durationMs());
        System.out.println("  Finish reason: " + result.finishReason());

        // --- Example 2: Typing-effect rendering ---
        System.out.println("\nExample: Typing-effect rendering...");
        Renderer.renderStreamToTerminal("Tell me about Christian discipleship.", token);
    }
}
