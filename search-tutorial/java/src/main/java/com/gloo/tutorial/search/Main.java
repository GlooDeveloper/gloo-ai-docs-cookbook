package com.gloo.tutorial.search;

import io.github.cdimascio.dotenv.Dotenv;
import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Gloo AI Search API - Java Example
 *
 * This program demonstrates how to use the Gloo AI Search API
 * to perform semantic search on your ingested content, with
 * support for filtering, pagination, and RAG.
 */
public class Main {

    // --- Configuration ---
    private static final Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
    private static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    private static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    private static final String TENANT = dotenv.get("GLOO_TENANT", "your-tenant-name");

    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";
    private static final String COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private static final Gson gson = new Gson();

    // --- Types ---

    static class SearchRequest {
        String query;
        String collection;
        String tenant;
        int limit;
        double certainty;
    }

    static class SearchMetadata {
        double distance;
        double certainty;
        double score;
    }

    static class SearchProperties {
        String item_title;
        String type;
        List<String> author;
        String snippet;
    }

    static class SearchResult {
        String uuid;
        SearchMetadata metadata;
        SearchProperties properties;
        String collection;
    }

    static class SearchResponse {
        List<SearchResult> data;
        int intent;
    }

    static class CompletionMessage {
        String role;
        String content;

        CompletionMessage(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }

    static class CompletionRequest {
        List<CompletionMessage> messages;
        @SerializedName("auto_routing")
        boolean autoRouting;
        @SerializedName("max_tokens")
        int maxTokens;
    }

    static class CompletionChoice {
        CompletionMessage message;
    }

    static class CompletionResponse {
        List<CompletionChoice> choices;
    }

    static class Snippet {
        String text;
        String title;
        String type;
        double relevance;
    }

    // --- Search Client ---

    /**
     * Perform a semantic search query.
     */
    static SearchResponse search(TokenManager tokenManager, String query, int limit)
            throws IOException, InterruptedException {
        String token = tokenManager.ensureValidToken();

        SearchRequest payload = new SearchRequest();
        payload.query = query;
        payload.collection = "GlooProd";
        payload.tenant = TENANT;
        payload.limit = limit;
        payload.certainty = 0.5;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(SEARCH_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            System.err.println("Search failed with status " + response.statusCode() + ": " + response.body());
            throw new IOException("Search request failed: HTTP " + response.statusCode());
        }

        return gson.fromJson(response.body(), SearchResponse.class);
    }

    /**
     * Filter search results by content type.
     */
    static SearchResponse filterByContentType(SearchResponse results, List<String> contentTypes) {
        if (results.data == null || results.data.isEmpty()) return results;

        Set<String> typeSet = new HashSet<>(contentTypes);
        SearchResponse filtered = new SearchResponse();
        filtered.intent = results.intent;
        filtered.data = results.data.stream()
                .filter(r -> typeSet.contains(r.properties.type))
                .collect(Collectors.toList());
        return filtered;
    }

    // --- RAG Helper ---

    /**
     * Extract and format snippets from search results for RAG.
     */
    static List<Snippet> extractSnippets(SearchResponse results, int maxSnippets, int maxCharsPerSnippet) {
        if (results.data == null || results.data.isEmpty()) return Collections.emptyList();

        List<Snippet> snippets = new ArrayList<>();
        for (int i = 0; i < Math.min(results.data.size(), maxSnippets); i++) {
            SearchResult r = results.data.get(i);
            Snippet s = new Snippet();
            String text = r.properties.snippet != null ? r.properties.snippet : "";
            s.text = text.length() > maxCharsPerSnippet ? text.substring(0, maxCharsPerSnippet) : text;
            s.title = r.properties.item_title != null ? r.properties.item_title : "N/A";
            s.type = r.properties.type != null ? r.properties.type : "N/A";
            s.relevance = r.metadata != null ? r.metadata.certainty : 0;
            snippets.add(s);
        }
        return snippets;
    }

    /**
     * Format extracted snippets as context for LLM.
     */
    static String formatContextForLLM(List<Snippet> snippets) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < snippets.size(); i++) {
            Snippet s = snippets.get(i);
            if (i > 0) sb.append("\n---\n");
            sb.append(String.format("[Source %d: %s (%s)]\n%s\n", i + 1, s.title, s.type, s.text));
        }
        return sb.toString();
    }

    /**
     * Call Completions V2 API with custom context.
     */
    static String generateWithContext(TokenManager tokenManager, String query, String context, String systemPrompt)
            throws IOException, InterruptedException {
        String token = tokenManager.ensureValidToken();

        if (systemPrompt == null || systemPrompt.isEmpty()) {
            systemPrompt = "You are a helpful assistant. Answer the user's question based on the "
                    + "provided context. If the context doesn't contain relevant information, "
                    + "say so honestly.";
        }

        CompletionRequest payload = new CompletionRequest();
        payload.messages = List.of(
                new CompletionMessage("system", systemPrompt),
                new CompletionMessage("user", "Context:\n" + context + "\n\nQuestion: " + query)
        );
        payload.autoRouting = true;
        payload.maxTokens = 1000;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(COMPLETIONS_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            System.err.println("Completions API failed: " + response.body());
            throw new IOException("Completions request failed: HTTP " + response.statusCode());
        }

        CompletionResponse result = gson.fromJson(response.body(), CompletionResponse.class);
        if (result.choices == null || result.choices.isEmpty()) return "";
        return result.choices.get(0).message.content;
    }

    // --- Commands ---

    static void basicSearch(String query, int limit) throws Exception {
        TokenManager tm = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL, httpClient);

        System.out.printf("Searching for: '%s'%n", query);
        System.out.printf("Limit: %d results%n%n", limit);

        SearchResponse results = search(tm, query, limit);

        if (results.data == null || results.data.isEmpty()) {
            System.out.println("No results found.");
            return;
        }

        System.out.printf("Found %d results:%n%n", results.data.size());

        for (int i = 0; i < results.data.size(); i++) {
            SearchResult r = results.data.get(i);
            System.out.printf("--- Result %d ---%n", i + 1);
            System.out.printf("Title: %s%n", r.properties.item_title != null ? r.properties.item_title : "N/A");
            System.out.printf("Type: %s%n", r.properties.type != null ? r.properties.type : "N/A");
            System.out.printf("Author: %s%n",
                    r.properties.author != null ? String.join(", ", r.properties.author) : "N/A");
            System.out.printf("Relevance Score: %.4f%n", r.metadata.certainty);

            String snippet = r.properties.snippet != null ? r.properties.snippet : "";
            if (!snippet.isEmpty()) {
                System.out.printf("Snippet: %s...%n",
                        snippet.length() > 200 ? snippet.substring(0, 200) : snippet);
            }
            System.out.println();
        }
    }

    static void filteredSearch(String query, List<String> contentTypes, int limit) throws Exception {
        TokenManager tm = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL, httpClient);

        System.out.printf("Searching for: '%s'%n", query);
        System.out.printf("Content types: %s%n", String.join(", ", contentTypes));
        System.out.printf("Limit: %d%n%n", limit);

        SearchResponse results = search(tm, query, limit);
        SearchResponse filtered = filterByContentType(results, contentTypes);

        if (filtered.data == null || filtered.data.isEmpty()) {
            System.out.println("No results found matching filters.");
            return;
        }

        System.out.printf("Found %d results:%n%n", filtered.data.size());

        for (int i = 0; i < filtered.data.size(); i++) {
            SearchResult r = filtered.data.get(i);
            System.out.printf("%d. %s (%s)%n", i + 1,
                    r.properties.item_title != null ? r.properties.item_title : "N/A",
                    r.properties.type != null ? r.properties.type : "N/A");
        }
    }

    static void ragSearch(String query, int limit) throws Exception {
        TokenManager tm = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL, httpClient);

        System.out.printf("RAG Search for: '%s'%n%n", query);

        System.out.println("Step 1: Searching for relevant content...");
        SearchResponse results = search(tm, query, limit);

        if (results.data == null || results.data.isEmpty()) {
            System.out.println("No results found.");
            return;
        }

        System.out.printf("Found %d results%n%n", results.data.size());

        System.out.println("Step 2: Extracting snippets...");
        List<Snippet> snippets = extractSnippets(results, limit, 500);
        String context = formatContextForLLM(snippets);
        System.out.printf("Extracted %d snippets%n%n", snippets.size());

        System.out.println("Step 3: Generating response with context...\n");
        String response = generateWithContext(tm, query, context, null);

        System.out.println("=== Generated Response ===");
        System.out.println(response);
        System.out.println("\n=== Sources Used ===");
        for (Snippet s : snippets) {
            System.out.printf("- %s (%s)%n", s.title, s.type);
        }
    }

    static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  mvn exec:java -Dexec.args=\"search <query> [limit]\"");
        System.out.println("  mvn exec:java -Dexec.args=\"filter <query> <types> [limit]\"");
        System.out.println("  mvn exec:java -Dexec.args=\"rag <query> [limit]\"");
        System.out.println("  mvn exec:java -Dexec.args=\"server [port]\"");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  mvn exec:java -Dexec.args='search \"How can I know my purpose?\" 5'");
        System.out.println("  mvn exec:java -Dexec.args='filter \"purpose\" \"Article,Video\" 10'");
        System.out.println("  mvn exec:java -Dexec.args='rag \"How can I know my purpose?\" 3'");
        System.out.println("  mvn exec:java -Dexec.args='server 3000'");
    }

    public static void main(String[] args) {
        TokenManager.validateCredentials(CLIENT_ID, CLIENT_SECRET);

        if (args.length < 1) {
            printUsage();
            System.exit(1);
        }

        String command = args[0].toLowerCase();

        // Server command doesn't need a query argument
        if (command.equals("server")) {
            try {
                int port = args.length > 1 ? Integer.parseInt(args[1]) : 3000;
                Server.start(port);
            } catch (Exception e) {
                System.err.println("Server failed: " + e.getMessage());
                System.exit(1);
            }
            return;
        }

        if (args.length < 2) {
            printUsage();
            System.exit(1);
        }

        String query = args[1];

        try {
            switch (command) {
                case "search" -> {
                    int limit = args.length > 2 ? Integer.parseInt(args[2]) : 10;
                    basicSearch(query, limit);
                }
                case "filter" -> {
                    if (args.length < 3) {
                        System.err.println("Error: Content types required for filter command");
                        printUsage();
                        System.exit(1);
                    }
                    List<String> types = List.of(args[2].split(","));
                    int limit = args.length > 3 ? Integer.parseInt(args[3]) : 10;
                    filteredSearch(query, types, limit);
                }
                case "rag" -> {
                    int limit = args.length > 2 ? Integer.parseInt(args[2]) : 5;
                    ragSearch(query, limit);
                }
                default -> {
                    System.err.printf("Error: Unknown command '%s'%n", command);
                    printUsage();
                    System.exit(1);
                }
            }
        } catch (Exception e) {
            System.err.println("An error occurred: " + e.getMessage());
            System.exit(1);
        }
    }
}
