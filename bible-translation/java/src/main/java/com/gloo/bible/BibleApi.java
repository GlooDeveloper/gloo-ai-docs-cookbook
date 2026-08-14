package com.gloo.bible;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Fetches chapter JSON from bible.helloao.org and extracts verse text.
 */
public final class BibleApi {

    private BibleApi() {}

    private static final String BIBLE_API_URL_TEMPLATE =
        "https://bible.helloao.org/api/%s/%s/%d.json";

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Fetch verse text from bible.helloao.org and return a formatted citation.
     */
    public static String fetchBibleVerse(String reference, String translation) {
        ReferenceParser.Reference parsed;
        try {
            parsed = ReferenceParser.parse(reference);
        } catch (IllegalArgumentException exc) {
            throw new RuntimeException(exc);
        }

        String url = String.format(
            BIBLE_API_URL_TEMPLATE,
            translation,
            parsed.bookId(),
            parsed.chapter()
        );

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .header("Accept", "application/json")
            .GET()
            .build();

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException | InterruptedException exc) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to fetch Bible chapter: " + exc.getMessage(), exc);
        }

        if (response.statusCode() != 200) {
            throw new RuntimeException(
                "Bible API HTTP error " + response.statusCode() + " for " + url
            );
        }

        JsonNode data;
        try {
            data = MAPPER.readTree(response.body());
        } catch (IOException exc) {
            throw new RuntimeException("Malformed Bible API response", exc);
        }

        JsonNode chapterContent = data.path("chapter").path("content");
        if (!chapterContent.isArray()) {
            throw new RuntimeException("Bible API response missing chapter.content array");
        }

        List<Integer> verses = new ArrayList<>(parsed.verses());
        if (verses.isEmpty()) {
            // Whole chapter: collect all verse numbers found.
            for (JsonNode item : chapterContent) {
                if (isVerse(item)) {
                    verses.add(item.get("number").asInt());
                }
            }
            Collections.sort(verses);
        }

        List<String> selected = new ArrayList<>();
        for (int verseNumber : verses) {
            String text = findVerseText(chapterContent, verseNumber);
            if (text == null) {
                throw new RuntimeException(
                    "Verse not found in " + reference + ": " + verseNumber
                );
            }
            selected.add(text);
        }

        String joined = selected.stream()
            .map(String::strip)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.joining(" "));
        return joined + " (" + reference + ", " + translation + ")";
    }

    private static boolean isVerse(JsonNode item) {
        return item.isObject()
            && "verse".equals(item.path("type").asText())
            && item.has("number");
    }

    private static String findVerseText(JsonNode chapterContent, int verseNumber) {
        for (JsonNode item : chapterContent) {
            if (isVerse(item) && item.get("number").asInt() == verseNumber) {
                return extractText(item.path("content")).strip();
            }
        }
        return null;
    }

    private static String extractText(JsonNode node) {
        StringBuilder sb = new StringBuilder();
        extractText(node, sb);
        return sb.toString();
    }

    private static void extractText(JsonNode node, StringBuilder sb) {
        if (node.isTextual()) {
            sb.append(node.asText());
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractText(child, sb);
            }
        } else if (node.isObject()) {
            JsonNode text = node.get("text");
            if (text != null && text.isTextual()) {
                sb.append(text.asText());
            } else {
                // Recurse into other object fields (e.g., nested content arrays).
                node.elements().forEachRemaining(child -> extractText(child, sb));
            }
        }
    }
}
