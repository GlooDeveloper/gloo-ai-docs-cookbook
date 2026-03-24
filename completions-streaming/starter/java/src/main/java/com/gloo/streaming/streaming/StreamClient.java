package com.gloo.streaming.streaming;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

/**
 * Streaming client for Gloo AI completions API.
 *
 * <p>Implements SSE parsing, token extraction, and accumulation loop for
 * real-time streaming responses using the Java 11+ HttpClient with
 * InputStream-based body handling.
 */
public class StreamClient {

    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final Gson GSON = new Gson();

    /** Result structure returned by {@link #streamCompletion}. */
    public record StreamResult(
        String text,
        int tokenCount,
        long durationMs,
        String finishReason
    ) {}

    /**
     * Check HTTP status before reading stream and throw specific errors.
     *
     * @param statusCode   HTTP status code
     * @param responseBody Response body snippet for generic errors
     * @throws RuntimeException with a descriptive message
     */
    public static void handleStreamError(int statusCode, String responseBody) {
        // TODO: Check statusCode and throw specific exceptions (Step 6):
        // 1. statusCode == 401: throw new RuntimeException("Authentication failed (401): Invalid or expired token")
        // 2. statusCode == 403: throw new RuntimeException("Authorization failed (403): Insufficient permissions")
        // 3. statusCode == 429: throw new RuntimeException("Rate limit exceeded (429): Too many requests")
        // 4. statusCode != 200: throw new RuntimeException("API error (" + statusCode + "): " + responseBody.substring(0, Math.min(200, responseBody.length())))
        // Do NOT throw for statusCode == 200 — that is a successful response.
        throw new RuntimeException("Not implemented - see TODO comments");
    }

    /**
     * POST to the completions API with stream:true.
     *
     * <p>Returns an {@link HttpResponse} whose body is an InputStream for
     * streaming. The caller should read and close the body.
     *
     * @param message The user message to send
     * @param token   Valid Bearer token
     * @return HttpResponse with InputStream body
     * @throws RuntimeException if the server returns a non-200 status
     */
    public static HttpResponse<java.io.InputStream> makeStreamingRequest(
        String message, String token
    ) {
        // TODO: Make a streaming POST request to the completions API (Step 2):
        // 1. Build JSON payload with GSON: messages, auto_routing: true, stream: true
        // 2. Build HttpRequest with Authorization: Bearer <token> and Content-Type: application/json
        // 3. Send with HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofInputStream())
        // 4. If response.statusCode() != 200: read body and call handleStreamError(statusCode, body)
        // 5. Return the HttpResponse (body InputStream not yet fully read)
        // Wrap checked exceptions in RuntimeException
        throw new RuntimeException("Not implemented - see TODO comments");
    }

    /**
     * Parse one SSE text line from the stream.
     *
     * SSE lines follow the format {@code data: <json-payload>}. The stream ends when a
     * chunk arrives with a non-null {@code choices[0].finish_reason} (e.g. "stop"). A
     * {@code [DONE]} sentinel is handled for compatibility but is not sent by the Gloo AI API.
     *
     * @param line Raw text line
     * @return null for blank/non-data lines; "[DONE]" if a [DONE] sentinel is encountered
     *   (not sent by Gloo AI); or a Map (parsed JSON)
     */
    public static Object parseSseLine(String line) {
        // TODO: Parse one SSE text line (Step 3):
        // 1. Return null if line is blank or does not start with "data: "
        // 2. Strip the prefix: String data = line.substring(6)
        // 3. Return "[DONE]" if data.trim().equals("[DONE]")
        // 4. Try GSON.fromJson(data, Map.class); return null on exception
        return null;
    }

    /**
     * Safely extract the text content from a parsed SSE chunk map.
     *
     * @param chunk Parsed JSON map from {@link #parseSseLine}
     * @return The token text, or "" if none present
     */
    @SuppressWarnings("unchecked")
    public static String extractTokenContent(Map<String, Object> chunk) {
        // TODO: Extract delta content from a parsed SSE chunk (Step 4):
        // 1. Get choices = (List<?>) chunk.get("choices") — return "" if null or empty
        // 2. Get delta = (Map<?,?>) ((Map<?,?>) choices.get(0)).get("delta")
        // 3. Return (String) delta.get("content"), or "" if null
        // Wrap in try/catch and return "" on any exception
        return "";
    }

    /**
     * Accumulation loop: stream a completion and collect the full result.
     *
     * @param message The user message to send
     * @param token   Valid Bearer token
     * @return StreamResult with text, tokenCount, durationMs, finishReason
     */
    @SuppressWarnings("unchecked")
    public static StreamResult streamCompletion(String message, String token) {
        // TODO: Implement the accumulation loop (Step 5):
        // 1. Record Instant start = Instant.now()
        // 2. Call makeStreamingRequest(message, token) to open the stream
        // 3. Initialize StringBuilder fullText, int tokenCount = 0, String finishReason = "unknown"
        // 4. Wrap in try-with-resources: new BufferedReader(new InputStreamReader(response.body()))
        // 5. Read line by line with reader.readLine():
        //    a. parseSseLine(line) — skip null, break on "[DONE]"
        //    b. extractTokenContent — append to fullText, increment tokenCount
        //    c. Capture choices[0].finish_reason when non-null
        // 6. Compute durationMs = Duration.between(start, Instant.now()).toMillis()
        // 7. Return new StreamResult(fullText.toString(), tokenCount, (int) durationMs, finishReason)
        throw new RuntimeException("Not implemented - see TODO comments");
    }
}
