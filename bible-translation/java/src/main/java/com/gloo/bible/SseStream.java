package com.gloo.bible;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Parses Server-Sent Events (SSE) lines from a Gloo AI Guarded Responses stream
 * and yields text deltas. Each event arrives as an {@code event:} line followed
 * by a {@code data:} line. Text comes from {@code response.output_text.delta};
 * other {@code response.*} events are lifecycle events and are ignored. Any
 * other event (such as {@code error}) ends the stream with an error, as does
 * malformed JSON.
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
            String event = null;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("event:")) {
                    event = line.substring("event:".length()).strip();
                    continue;
                }
                if (!line.startsWith("data:")) {
                    continue;
                }
                String payload = line.substring("data:".length()).strip();
                JsonNode data;
                try {
                    data = MAPPER.readTree(payload);
                } catch (IOException exc) {
                    throw new IOException("Received malformed JSON in an SSE data event", exc);
                }
                String current = event;
                event = null;
                if ("response.output_text.delta".equals(current)) {
                    JsonNode delta = data.path("delta");
                    if (delta.isTextual() && !delta.asText().isEmpty()) {
                        consumer.accept(delta.asText());
                    }
                } else if ("response.completed".equals(current)) {
                    break;
                } else if (current == null || !current.startsWith("response.")) {
                    throw new IOException("Stream terminated by event '" + current + "': " + payload);
                }
            }
        }
    }
}
