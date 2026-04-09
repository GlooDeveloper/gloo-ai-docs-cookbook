package com.gloo.tutorial.recommendations;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Gloo AI Recommendations API - Java Example
 *
 * Demonstrates three recommendation modes:
 *   base       - Publisher-scoped ranked items (metadata only)
 *   verbose    - Publisher-scoped ranked items (with snippet text)
 *   affiliates - Cross-publisher Gloo affiliate network discovery
 */
public class Main {

    static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    static final Gson gson = new Gson();

    // --- Request Types ---

    static class RecommendationsRequest {
        String query;
        int item_count;
        double certainty_threshold;
        String collection;
        String tenant;
    }

    static class AffiliatesRequest {
        String query;
        int item_count;
        double certainty_threshold;
    }

    // --- Response Types ---

    static class SnippetUUIDBase {
        String uuid;
        String ai_title;
        String ai_subtitle;
        String item_summary;
        double certainty;
    }

    static class RecommendationItemBase {
        String item_id;
        String item_title;
        List<String> author;
        String item_url;
        List<SnippetUUIDBase> uuids;
    }

    static class SnippetUUIDVerbose {
        String uuid;
        String ai_title;
        String ai_subtitle;
        String item_summary;
        double certainty;
        String snippet;
    }

    static class RecommendationItemVerbose {
        String item_id;
        String item_title;
        List<String> author;
        String item_url;
        List<SnippetUUIDVerbose> uuids;
    }

    static class AffiliateItem {
        String item_title;
        String item_subtitle;
        List<String> author;
        String tradition;
        String item_url;
    }

    // --- API Client Methods ---

    /**
     * Fetch publisher-scoped recommendations (metadata only).
     */
    static List<RecommendationItemBase> getBase(TokenManager tm, String query, int itemCount)
            throws IOException, InterruptedException {
        String token = tm.ensureValidToken();

        RecommendationsRequest payload = new RecommendationsRequest();
        payload.query = query;
        payload.item_count = itemCount;
        payload.certainty_threshold = 0.75;
        payload.collection = AppConfig.COLLECTION;
        payload.tenant = AppConfig.TENANT;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(AppConfig.RECOMMENDATIONS_BASE_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            System.err.println("Base recommendations failed: " + response.body());
            throw new IOException("Base recommendations request failed: HTTP " + response.statusCode());
        }

        Type listType = new TypeToken<List<RecommendationItemBase>>() {}.getType();
        return gson.fromJson(response.body(), listType);
    }

    /**
     * Fetch publisher-scoped recommendations with snippet text.
     */
    static List<RecommendationItemVerbose> getVerbose(TokenManager tm, String query, int itemCount)
            throws IOException, InterruptedException {
        String token = tm.ensureValidToken();

        RecommendationsRequest payload = new RecommendationsRequest();
        payload.query = query;
        payload.item_count = itemCount;
        payload.certainty_threshold = 0.75;
        payload.collection = AppConfig.COLLECTION;
        payload.tenant = AppConfig.TENANT;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(AppConfig.RECOMMENDATIONS_VERBOSE_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            System.err.println("Verbose recommendations failed: " + response.body());
            throw new IOException("Verbose recommendations request failed: HTTP " + response.statusCode());
        }

        Type listType = new TypeToken<List<RecommendationItemVerbose>>() {}.getType();
        return gson.fromJson(response.body(), listType);
    }

    /**
     * Fetch items from across the Gloo affiliate publisher network.
     * No collection or tenant required.
     */
    static List<AffiliateItem> getReferencedItems(TokenManager tm, String query, int itemCount)
            throws IOException, InterruptedException {
        String token = tm.ensureValidToken();

        AffiliatesRequest payload = new AffiliatesRequest();
        payload.query = query;
        payload.item_count = itemCount;
        payload.certainty_threshold = 0.75;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(AppConfig.AFFILIATES_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            System.err.println("Affiliates request failed: " + response.body());
            throw new IOException("Affiliates request failed: HTTP " + response.statusCode());
        }

        Type listType = new TypeToken<List<AffiliateItem>>() {}.getType();
        return gson.fromJson(response.body(), listType);
    }

    // --- Command Functions ---

    static void runBase(String query, int itemCount) throws Exception {
        TokenManager tm = new TokenManager(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET,
                AppConfig.TOKEN_URL, httpClient);

        System.out.printf("Fetching recommendations for: '%s'%n", query);
        System.out.printf("Collection: %s | Tenant: %s%n", AppConfig.COLLECTION, AppConfig.TENANT);
        System.out.printf("Requesting up to %d items%n%n", itemCount);

        List<RecommendationItemBase> items = getBase(tm, query, itemCount);

        if (items == null || items.isEmpty()) {
            System.out.println("No recommendations found.");
            return;
        }

        System.out.printf("Found %d item(s):%n%n", items.size());

        for (int i = 0; i < items.size(); i++) {
            RecommendationItemBase item = items.get(i);
            System.out.printf("--- Item %d ---%n", i + 1);
            System.out.printf("Title:  %s%n", item.item_title != null ? item.item_title : "N/A");

            if (item.author != null && !item.author.isEmpty()) {
                System.out.printf("Author: %s%n", String.join(", ", item.author));
            }
            if (item.item_url != null && !item.item_url.isEmpty()) {
                System.out.printf("URL:    %s%n", item.item_url);
            }

            if (item.uuids != null && !item.uuids.isEmpty()) {
                SnippetUUIDBase top = item.uuids.get(0);
                System.out.printf("Relevance: %.0f%%%n", top.certainty * 100);
                if (top.ai_title != null && !top.ai_title.isEmpty()) {
                    System.out.printf("Section:   %s%n", top.ai_title);
                }
                if (top.item_summary != null && !top.item_summary.isEmpty()) {
                    System.out.printf("Summary:   %s%n", top.item_summary);
                }
            }
            System.out.println();
        }
    }

    static void runVerbose(String query, int itemCount) throws Exception {
        TokenManager tm = new TokenManager(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET,
                AppConfig.TOKEN_URL, httpClient);

        System.out.printf("Fetching verbose recommendations for: '%s'%n", query);
        System.out.printf("Collection: %s | Tenant: %s%n", AppConfig.COLLECTION, AppConfig.TENANT);
        System.out.printf("Requesting up to %d items%n%n", itemCount);

        List<RecommendationItemVerbose> items = getVerbose(tm, query, itemCount);

        if (items == null || items.isEmpty()) {
            System.out.println("No recommendations found.");
            return;
        }

        System.out.printf("Found %d item(s):%n%n", items.size());

        for (int i = 0; i < items.size(); i++) {
            RecommendationItemVerbose item = items.get(i);
            System.out.printf("--- Item %d ---%n", i + 1);
            System.out.printf("Title:  %s%n", item.item_title != null ? item.item_title : "N/A");

            if (item.author != null && !item.author.isEmpty()) {
                System.out.printf("Author: %s%n", String.join(", ", item.author));
            }
            if (item.item_url != null && !item.item_url.isEmpty()) {
                System.out.printf("URL:    %s%n", item.item_url);
            }

            if (item.uuids != null && !item.uuids.isEmpty()) {
                SnippetUUIDVerbose top = item.uuids.get(0);
                System.out.printf("Relevance: %.0f%%%n", top.certainty * 100);
                if (top.ai_title != null && !top.ai_title.isEmpty()) {
                    System.out.printf("Section:   %s%n", top.ai_title);
                }
                if (top.item_summary != null && !top.item_summary.isEmpty()) {
                    System.out.printf("Summary:   %s%n", top.item_summary);
                }
                if (top.snippet != null && !top.snippet.isEmpty()) {
                    String preview = top.snippet.length() > 200
                            ? top.snippet.substring(0, 200) + "..."
                            : top.snippet;
                    System.out.printf("Preview:   \"%s\"%n", preview);
                }
            }
            System.out.println();
        }
    }

    static void runAffiliates(String query, int itemCount) throws Exception {
        TokenManager tm = new TokenManager(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET,
                AppConfig.TOKEN_URL, httpClient);

        System.out.printf("Fetching affiliate recommendations for: '%s'%n", query);
        System.out.println("Searching across the Gloo affiliate network...");
        System.out.printf("Requesting up to %d items%n%n", itemCount);

        List<AffiliateItem> items = getReferencedItems(tm, query, itemCount);

        if (items == null || items.isEmpty()) {
            System.out.println("No affiliate items found.");
            return;
        }

        System.out.printf("Found %d item(s) from across the affiliate network:%n%n", items.size());

        for (int i = 0; i < items.size(); i++) {
            AffiliateItem item = items.get(i);
            System.out.printf("--- Item %d ---%n", i + 1);
            System.out.printf("Title:     %s%n", item.item_title != null ? item.item_title : "N/A");

            if (item.author != null && !item.author.isEmpty()) {
                System.out.printf("Author:    %s%n", String.join(", ", item.author));
            }
            if (item.tradition != null && !item.tradition.isEmpty()) {
                System.out.printf("Tradition: %s%n", item.tradition);
            }
            if (item.item_subtitle != null && !item.item_subtitle.isEmpty()) {
                System.out.printf("Subtitle:  %s%n", item.item_subtitle);
            }
            if (item.item_url != null && !item.item_url.isEmpty()) {
                System.out.printf("URL:       %s%n", item.item_url);
            }
            System.out.println();
        }
    }

    static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  mvn -q exec:java -Dexec.args=\"base <query> [item_count]\"");
        System.out.println("  mvn -q exec:java -Dexec.args=\"verbose <query> [item_count]\"");
        System.out.println("  mvn -q exec:java -Dexec.args=\"affiliates <query> [item_count]\"");
        System.out.println("  mvn -q exec:java -Dexec.args=\"server\"");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  mvn -q exec:java -Dexec.args='base \"How do I deal with anxiety?\"'");
        System.out.println("  mvn -q exec:java -Dexec.args='base \"parenting teenagers\" 3'");
        System.out.println("  mvn -q exec:java -Dexec.args='verbose \"How do I deal with anxiety?\"'");
        System.out.println("  mvn -q exec:java -Dexec.args='verbose \"parenting teenagers\" 3'");
        System.out.println("  mvn -q exec:java -Dexec.args='affiliates \"How do I deal with anxiety?\"'");
        System.out.println("  mvn -q exec:java -Dexec.args='affiliates \"parenting teenagers\" 3'");
        System.out.println("  mvn -q exec:java -Dexec.args='server'");
    }

    public static void main(String[] args) {
        TokenManager.validateCredentials(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET);

        if (args.length < 1) {
            printUsage();
            System.exit(1);
        }

        String command = args[0].toLowerCase();

        if (command.equals("server")) {
            try {
                Server.start(AppConfig.PORT);
            } catch (Exception e) {
                System.err.println("Server failed: " + e.getMessage());
                System.exit(1);
            }
            return;
        }

        if (args.length < 2) {
            System.err.printf("Error: query argument required for '%s' command%n%n", command);
            printUsage();
            System.exit(1);
        }

        String query = args[1];
        int itemCount = AppConfig.DEFAULT_ITEM_COUNT;
        if (args.length > 2) {
            itemCount = AppConfig.parseItemCount(args[2], AppConfig.DEFAULT_ITEM_COUNT);
        }

        try {
            switch (command) {
                case "base"       -> runBase(query, itemCount);
                case "verbose"    -> runVerbose(query, itemCount);
                case "affiliates" -> runAffiliates(query, itemCount);
                default -> {
                    System.err.printf("Error: Unknown command '%s'%n%n", command);
                    printUsage();
                    System.exit(1);
                }
            }
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
        }
    }
}
