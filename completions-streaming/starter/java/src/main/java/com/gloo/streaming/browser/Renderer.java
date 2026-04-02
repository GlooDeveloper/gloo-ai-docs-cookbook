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
        // 1. Print the prompt header and open the streaming request, initializing tracking variables
        // 2. Wrap iteration in a try block using BufferedReader on the response body
        // 3. Read line by line, parsing each SSE line and breaking on the stream termination signal
        // 4. Extract content from valid chunks and write each token immediately to stdout without a newline
        // 5. Track the total token count and capture the finish reason from the final chunk
        // 6. Print a final newline followed by the token count and finish reason summary
        throw new RuntimeException("Not implemented - see TODO comments");
    }
}
