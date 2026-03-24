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
        // TODO: Implement the typing-effect terminal renderer (Step 7):
        // 1. Print the prompt: System.out.print("Prompt: " + message + "\n\nResponse: ")
        // 2. Call StreamClient.makeStreamingRequest(message, token)
        // 3. Initialize int totalTokens = 0, String finishReason = "unknown"
        // 4. Use BufferedReader on response.body() to read line by line:
        //    a. StreamClient.parseSseLine(line) — skip null, break on "[DONE]"
        //    b. StreamClient.extractTokenContent(chunk) — print without newline: System.out.print(content); System.out.flush()
        //    c. Increment totalTokens, capture finishReason
        // 5. Print final newline and summary: System.out.printf("\n\n[%d tokens, finish_reason=%s]%n", totalTokens, finishReason)
        // Wrap checked exceptions in RuntimeException
        throw new RuntimeException("Not implemented - see TODO comments");
    }
}
