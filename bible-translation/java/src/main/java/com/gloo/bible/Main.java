package com.gloo.bible;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.cdimascio.dotenv.Dotenv;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CLI entry point that loads environment vars, parses args, makes the streaming
 * HTTP request, and wires up the placeholder substitution logic.
 */
public final class Main {

    private Main() {}

    public static final String GLOO_API_URL =
        "https://platform.ai.gloo.com/ai/v2/chat/completions";

    public static final String SYSTEM_PROMPT =
        "Never quote Bible verses directly from memory. When you want to reference "
        + "a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} "
        + "(e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system "
        + "will replace these placeholders with the actual verse text from the "
        + "specified Bible translation. You may still discuss, explain, and comment "
        + "on Scripture, but the actual verse text must always come through the "
        + "placeholder mechanism.";

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        String apiKey = dotenv.get("GLOO_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            System.err.println(
                "Error: GLOO_API_KEY is not set. "
                + "Get your API key from https://studio.ai.gloo.com/api-keys "
                + "and add it to your environment or .env file."
            );
            System.exit(1);
        }

        ParsedArgs parsed = ParsedArgs.parse(args);

        Map<String, Object> body = buildRequestBody(parsed.prompt, parsed.tradition);

        String requestBody;
        try {
            requestBody = MAPPER.writeValueAsString(body);
        } catch (IOException exc) {
            System.err.println("Error: failed to serialize request body: " + exc.getMessage());
            System.exit(1);
            return;
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(GLOO_API_URL))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<InputStream> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException | InterruptedException exc) {
            Thread.currentThread().interrupt();
            System.err.println("Error: failed to connect to Gloo AI API: " + exc.getMessage());
            System.exit(1);
            return;
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String bodyText;
            try (InputStream err = response.body()) {
                bodyText = new String(err.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            } catch (IOException exc) {
                bodyText = "";
            }
            System.err.println(
                "Error: Gloo AI API returned HTTP " + response.statusCode() + ": " + bodyText
            );
            System.exit(1);
            return;
        }

        SubstitutionStream.Processor processor = new SubstitutionStream.Processor(
            reference -> BibleApi.fetchBibleVerse(reference, parsed.translation),
            chunk -> {
                System.out.print(chunk);
                System.out.flush();
            }
        );

        try (InputStream stream = response.body()) {
            SseStream.streamContentDeltas(stream, processor::onDelta);
            processor.onEnd();
        } catch (IOException exc) {
            System.err.println("\nError: streaming failed: " + exc.getMessage());
            System.exit(1);
            return;
        }

        if (processor.getStderr().length() > 0) {
            System.err.print(processor.getStderr());
        }

        System.out.println();
    }

    static Map<String, Object> buildRequestBody(String prompt, String tradition) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messages", List.of(
            Map.of("role", "system", "content", SYSTEM_PROMPT),
            Map.of("role", "user", "content", prompt)
        ));
        body.put("auto_routing", true);
        body.put("stream", true);
        if (tradition != null) {
            body.put("tradition", tradition);
        }
        return body;
    }

    static final class ParsedArgs {
        final String prompt;
        final String tradition;
        final String translation;

        ParsedArgs(String prompt, String tradition, String translation) {
            this.prompt = prompt;
            this.tradition = tradition;
            this.translation = translation;
        }

        static ParsedArgs parse(String[] args) {
            String prompt = null;
            String tradition = null;
            String translation = "BSB";

            for (int i = 0; i < args.length; i++) {
                String arg = args[i];
                if ("--tradition".equals(arg)) {
                    if (i + 1 >= args.length) {
                        System.err.println("Error: --tradition requires a value");
                        System.exit(1);
                    }
                    tradition = args[++i];
                } else if ("--translation".equals(arg)) {
                    if (i + 1 >= args.length) {
                        System.err.println("Error: --translation requires a value");
                        System.exit(1);
                    }
                    translation = args[++i];
                } else if (arg.startsWith("--")) {
                    System.err.println("Error: unknown argument " + arg);
                    System.exit(1);
                } else {
                    if (prompt == null) {
                        prompt = arg;
                    } else {
                        prompt = prompt + " " + arg;
                    }
                }
            }

            if (prompt == null || prompt.isBlank()) {
                System.err.println("Error: prompt is required");
                System.exit(1);
            }

            return new ParsedArgs(prompt, tradition, translation);
        }
    }
}
