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
        switch (statusCode) {
            case 200 -> { /* ok */ }
            case 401 -> throw new RuntimeException(
                "Authentication failed (401): Invalid or expired token"
            );
            case 403 -> throw new RuntimeException(
                "Authorization failed (403): Insufficient permissions"
            );
            case 429 -> throw new RuntimeException(
                "Rate limit exceeded (429): Too many requests"
            );
            default -> {
                String preview = responseBody != null && responseBody.length() > 200
                    ? responseBody.substring(0, 200) : responseBody;
                throw new RuntimeException("API error (" + statusCode + "): " + preview);
            }
        }
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
        String payload = GSON.toJson(Map.of(
            "messages", List.of(Map.of("role", "user", "content", message)),
            "auto_routing", true,
            "stream", true
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        try {
            HttpResponse<java.io.InputStream> response = HTTP_CLIENT.send(
                request, HttpResponse.BodyHandlers.ofInputStream()
            );
            if (response.statusCode() != 200) {
                String body = new String(response.body().readAllBytes(), StandardCharsets.UTF_8);
                handleStreamError(response.statusCode(), body);
            }
            return response;
        } catch (Exception e) {
            if (e instanceof RuntimeException re) throw re;
            throw new RuntimeException("Streaming request failed: " + e.getMessage(), e);
        }
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
        if (line == null || line.isBlank()) return null;
        if (!line.startsWith("data: ")) return null;
        String data = line.substring(6); // strip "data: "
        if (data.trim().equals("[DONE]")) return "[DONE]";
        try {
            return GSON.fromJson(data, new TypeToken<Map<String, Object>>() {}.getType());
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Safely extract the text content from a parsed SSE chunk map.
     *
     * @param chunk Parsed JSON map from {@link #parseSseLine}
     * @return The token text, or "" if none present
     */
    @SuppressWarnings("unchecked")
    public static String extractTokenContent(Map<String, Object> chunk) {
        try {
            List<Map<String, Object>> choices =
                (List<Map<String, Object>>) chunk.get("choices");
            if (choices == null || choices.isEmpty()) return "";
            Map<String, Object> delta = (Map<String, Object>) choices.get(0).get("delta");
            if (delta == null) return "";
            Object content = delta.get("content");
            return content != null ? content.toString() : "";
        } catch (Exception e) {
            return "";
        }
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
        Instant start = Instant.now();
        HttpResponse<java.io.InputStream> response = makeStreamingRequest(message, token);

        StringBuilder fullText = new StringBuilder();
        int tokenCount = 0;
        String finishReason = "unknown";

        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(response.body(), StandardCharsets.UTF_8)
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                Object parsed = parseSseLine(line);
                if (parsed == null) continue;
                if ("[DONE]".equals(parsed)) break;

                Map<String, Object> chunk = (Map<String, Object>) parsed;
                String content = extractTokenContent(chunk);
                if (!content.isEmpty()) {
                    fullText.append(content);
                    tokenCount++;
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
            if (fullText.length() == 0) {
                throw new RuntimeException("Stream read failed: " + e.getMessage(), e);
            }
            // Preserve partial output
        }

        long durationMs = Instant.now().toEpochMilli() - start.toEpochMilli();
        return new StreamResult(fullText.toString(), tokenCount, durationMs, finishReason);
    }
}
