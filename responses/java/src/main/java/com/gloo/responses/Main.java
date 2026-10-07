package com.gloo.responses;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gloo AI Guarded Responses API Recipe - Java
 *
 * This example demonstrates four features of the Gloo AI Responses API
 * (POST /ai/v2/guarded/responses): basic guarded responses with tradition,
 * instructions + multi-turn input, streaming (SSE), and vision (image input).
 */
public class Main {

    // Configuration
    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/responses";

    private final String apiKey;
    private final String model;
    private final String visionModel;
    private final String visionImageUrl;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private static final Gson gson = new Gson();

    public Main(String apiKey, String model, String visionModel, String visionImageUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.visionModel = visionModel;
        this.visionImageUrl = visionImageUrl;
    }

    /**
     * Env value or default, ignoring unset placeholders (empty / TODO comments,
     * mirroring the Python _env helper).
     */
    private static String env(Dotenv dotenv, String name, String fallback) {
        String value = dotenv.get(name);
        if (value == null) {
            value = System.getenv(name);
        }
        if (value == null) {
            return fallback;
        }
        String stripped = value.trim();
        if (stripped.isEmpty() || stripped.startsWith("#")) {
            return fallback;
        }
        return value;
    }

    /**
     * POST a request, raising a clear error (including the response body) on failure.
     */
    private JsonObject post(Map<String, Object> payload) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String hint = response.statusCode() == 403 ? " (guardrails hard-blocked this request)" : "";
            throw new IOException("API request failed with status " + response.statusCode() + hint + ": " + response.body());
        }

        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    /**
     * Extract assistant text from a Responses API payload's output[] array.
     */
    private static String extractText(JsonObject result) {
        List<String> parts = new ArrayList<>();
        JsonElement output = result.get("output");
        if (output != null && output.isJsonArray()) {
            for (JsonElement itemObj : output.getAsJsonArray()) {
                if (!itemObj.isJsonObject()) {
                    continue;
                }
                JsonObject item = itemObj.getAsJsonObject();
                if (!item.has("type") || !"message".equals(item.get("type").getAsString())) {
                    continue;
                }
                JsonElement content = item.get("content");
                if (content == null || !content.isJsonArray()) {
                    continue;
                }
                for (JsonElement partObj : content.getAsJsonArray()) {
                    if (!partObj.isJsonObject()) {
                        continue;
                    }
                    JsonObject part = partObj.getAsJsonObject();
                    if (part.has("type") && "output_text".equals(part.get("type").getAsString())) {
                        JsonElement text = part.get("text");
                        parts.add(text == null || text.isJsonNull() ? "" : text.getAsString());
                    }
                }
            }
        }
        return String.join("\n", parts);
    }

    /**
     * Example 1: Basic guarded response with a theological tradition.
     */
    public JsonObject makeBasicResponse(String message, String tradition) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("input", message);
        payload.put("tradition", tradition);
        payload.put("max_output_tokens", 256);
        return post(payload);
    }

    /**
     * Example 2: Instructions plus multi-turn input array (alternating user/assistant roles).
     */
    public JsonObject makeInstructionsResponse(String instructions, List<Map<String, Object>> inputItems)
            throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("instructions", instructions);
        payload.put("input", inputItems);
        payload.put("max_output_tokens", 256);
        return post(payload);
    }

    /**
     * Example 3: Streaming via SSE; returns the accumulated text and usage.
     *
     * Note: each data: payload is the flattened event object itself (its "type"
     * matches the event: line); there is no nested "response" key, and the
     * response.completed payload carries usage but not the output[] array.
     */
    public Map<String, Object> streamResponse(String message) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("input", message);
        payload.put("stream", true);
        payload.put("max_output_tokens", 256);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .build();

        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body;
            try (InputStream is = response.body()) {
                body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
            String hint = response.statusCode() == 403 ? " (guardrails hard-blocked this request)" : "";
            throw new IOException("API request failed with status " + response.statusCode() + hint + ": " + body);
        }

        StringBuilder textBuilder = new StringBuilder();
        StringBuilder doneBuilder = new StringBuilder();
        JsonElement usage = null;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String event = null;
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("event:")) {
                    event = line.substring("event:".length()).trim();
                    continue;
                }
                if (!line.startsWith("data:")) {
                    continue;
                }

                JsonObject data;
                try {
                    data = JsonParser.parseString(line.substring("data:".length()).trim()).getAsJsonObject();
                } catch (JsonParseException e) {
                    // Malformed SSE data is a terminal error, not something to skip.
                    throw new IOException("Stream terminated by malformed SSE data: " + line, e);
                }

                if ("response.output_text.delta".equals(event)) {
                    String delta = data.has("delta") && !data.get("delta").isJsonNull()
                            ? data.get("delta").getAsString() : "";
                    System.out.print(delta);
                    textBuilder.append(delta);
                } else if ("response.output_text.done".equals(event)) {
                    String text = data.has("text") && !data.get("text").isJsonNull()
                            ? data.get("text").getAsString() : "";
                    doneBuilder.append(text);
                } else if ("response.completed".equals(event)) {
                    // Docs nest the final response under "response"; the live API
                    // flattens it into the payload itself. Accept both shapes.
                    JsonObject finalResponse = data.has("response") && data.get("response").isJsonObject()
                            ? data.getAsJsonObject("response")
                            : data;
                    usage = finalResponse.get("usage");
                    if (textBuilder.length() == 0 && doneBuilder.length() == 0) {
                        doneBuilder.append(extractText(finalResponse));
                    }
                } else if (event != null && event.startsWith("response.")) {
                    // Other lifecycle events (response.created, response.in_progress,
                    // response.output_item.*, response.content_part.*, ...).
                } else if (event != null && event.startsWith("error")) {
                    // Error events are terminal.
                    throw new IOException("Stream error event '" + event + "': " + gson.toJson(data));
                } else {
                    // Unknown event: treat as terminal and close the stream.
                    throw new IOException("Stream terminated by unknown event '" + event + "': " + gson.toJson(data));
                }

                event = null;
            }
        }

        System.out.println();
        String text = textBuilder.length() > 0 ? textBuilder.toString() : doneBuilder.toString();
        Map<String, Object> result = new HashMap<>();
        result.put("text", text);
        result.put("usage", usage);
        return result;
    }

    /**
     * Example 4: Vision — image input via typed content parts.
     */
    public JsonObject makeVisionResponse(String imageUrl, String question) throws IOException, InterruptedException {
        Map<String, Object> textPart = new HashMap<>();
        textPart.put("type", "input_text");
        textPart.put("text", question);
        Map<String, Object> imagePart = new HashMap<>();
        imagePart.put("type", "input_image");
        imagePart.put("image_url", imageUrl);

        Map<String, Object> inputItem = new HashMap<>();
        inputItem.put("role", "user");
        inputItem.put("content", List.of(textPart, imagePart));

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", visionModel);
        payload.put("input", List.of(inputItem));
        payload.put("max_output_tokens", 256);
        return post(payload);
    }

    /**
     * Truncate a string to a maximum length.
     */
    private static String truncate(String s, int maxLen) {
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    /**
     * Render a usage element like Python's result.get("usage", "N/A").
     */
    private static String usageOrNA(JsonElement usage) {
        return usage == null || usage.isJsonNull() ? "N/A" : gson.toJson(usage);
    }

    /**
     * Run all four examples against the live API.
     */
    public boolean testResponsesApi() {
        System.out.println("=== Gloo AI Guarded Responses API Test ===\n");

        try {
            // Example 1: Basic guarded response with tradition
            System.out.println("Example 1: Basic Guarded Response (tradition=evangelical)");
            System.out.println("Testing: How can our small group support a grieving member?");
            JsonObject result1 = makeBasicResponse("How can our small group support a grieving member?", "evangelical");
            System.out.println("   Model used: " + (result1.has("model") ? result1.get("model").getAsString() : "N/A"));
            String text1 = extractText(result1);
            System.out.println("   Response: " + truncate(text1, 100) + "...");
            System.out.println("   Usage: " + usageOrNA(result1.get("usage")));
            System.out.println("   ✓ Example 1 passed\n");

            // Example 2: Instructions + multi-turn input
            System.out.println("Example 2: Instructions + Multi-turn Input");
            System.out.println("Testing: three-turn conversation (user → assistant → user) with pastoral-care instructions");
            List<Map<String, Object>> inputItems = new ArrayList<>();
            Map<String, Object> turn1 = new HashMap<>();
            turn1.put("role", "user");
            turn1.put("content", "I've been asked to lead a grief support group at church. Where do I start?");
            Map<String, Object> turn2 = new HashMap<>();
            turn2.put("role", "assistant");
            turn2.put("content", "That's a meaningful calling. Start with prayerful preparation — ask God to prepare your own heart before you prepare the room.");
            Map<String, Object> turn3 = new HashMap<>();
            turn3.put("role", "user");
            turn3.put("content", "What should I do in the very first meeting?");
            inputItems.add(turn1);
            inputItems.add(turn2);
            inputItems.add(turn3);

            JsonObject result2 = makeInstructionsResponse(
                    "You are a compassionate pastoral assistant. Keep answers brief and warm.", inputItems);
            System.out.println("   Model used: " + (result2.has("model") ? result2.get("model").getAsString() : "N/A"));
            String text2 = extractText(result2);
            System.out.println("   Response: " + truncate(text2, 100) + "...");
            System.out.println("   Usage: " + usageOrNA(result2.get("usage")));
            System.out.println("   ✓ Example 2 passed\n");

            // Example 3: Streaming
            System.out.println("Example 3: Streaming (SSE)");
            System.out.println("Testing: Write a one-paragraph prayer for a new season of ministry.");
            Map<String, Object> streamed = streamResponse("Write a one-paragraph prayer for a new season of ministry.");
            String text3 = (String) streamed.get("text");
            JsonElement usage3 = (JsonElement) streamed.get("usage");
            System.out.println("   Model used: " + model);
            System.out.println("   Streamed text (" + text3.length() + " chars): " + truncate(text3, 100) + "...");
            System.out.println("   Usage: " + (usage3 == null ? "N/A" : gson.toJson(usage3)));
            if (text3.isEmpty()) {
                throw new IOException("streaming produced no text");
            }
            if (usage3 == null) {
                throw new IOException("streaming produced no usage");
            }
            System.out.println("   ✓ Example 3 passed\n");

            // Example 4: Vision
            System.out.println("Example 4: Vision (Image Input)");
            System.out.println("Testing: " + visionImageUrl);
            JsonObject result4 = makeVisionResponse(visionImageUrl, "What animal is in this image?");
            System.out.println("   Model used: " + (result4.has("model") ? result4.get("model").getAsString() : "N/A"));
            String text4 = extractText(result4);
            System.out.println("   Response: " + truncate(text4, 100) + "...");
            System.out.println("   Usage: " + usageOrNA(result4.get("usage")));
            System.out.println("   ✓ Example 4 passed\n");

            System.out.println("=== All Responses API tests passed! ===");
            return true;
        } catch (Exception e) {
            System.out.println("✗ Test failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * Main execution.
     */
    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

        String apiKey = env(dotenv, "GLOO_API_KEY", "YOUR_API_KEY");
        if (apiKey.equals("YOUR_API_KEY")) {
            System.out.println("Please set your GLOO_API_KEY environment variable");
            System.out.println("You can create a .env file with:");
            System.out.println("GLOO_API_KEY=your_api_key");
            return;
        }

        String model = env(dotenv, "GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6");
        String visionModel = env(dotenv, "GLOO_VISION_MODEL", "gloo-google-gemini-3.1-pro");
        String visionImageUrl = env(dotenv, "VISION_IMAGE_URL",
                "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg");

        Main app = new Main(apiKey, model, visionModel, visionImageUrl);
        if (!app.testResponsesApi()) {
            System.exit(1);
        }
    }
}
