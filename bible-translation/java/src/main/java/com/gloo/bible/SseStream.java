package com.gloo.bible;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Parses Server-Sent Events (SSE) lines from a Gloo AI streaming response and
 * yields content deltas. Malformed JSON is surfaced as an error.
 */
public final class SseStream {

    private SseStream() {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Reads SSE lines from the input stream and invokes the consumer for each
     * content delta. The stream is closed before returning.
     */
    public static void streamContentDeltas(InputStream input, java.util.function.Consumer<String> consumer)
        throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    continue;
                }
                if (!line.startsWith("data: ")) {
                    continue;
                }
                String payload = line.substring("data: ".length());
                if ("[DONE]".equals(payload)) {
                    break;
                }
                JsonNode chunk;
                try {
                    chunk = MAPPER.readTree(payload);
                } catch (IOException exc) {
                    throw new IOException("Received malformed JSON in an SSE data event", exc);
                }
                JsonNode content = chunk.path("choices").get(0)
                    .path("delta").path("content");
                if (content != null && content.isTextual()) {
                    consumer.accept(content.asText());
                }
            }
        }
    }
}
