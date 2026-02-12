package com.gloo.tutorial.search;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Gloo AI Search API - Proxy Server (Java HttpServer)
 *
 * A lightweight HTTP server that proxies search requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Start with:
 *   mvn exec:java -Dexec.args="server"
 *
 * Endpoints:
 *   GET  /api/search?q=query&limit=10  - Basic search
 *   POST /api/search/rag               - Search + RAG with Completions V2
 */
public class Server {

    private static final Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
    private static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    private static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    private static final String TENANT = dotenv.get("GLOO_TENANT", "your-tenant-name");
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private static final Gson gson = new Gson();

    static class RAGRequest {
        String query;
        int limit;
        String systemPrompt;
    }

    static class RAGResponsePayload {
        String response;
        List<SourceInfo> sources;

        RAGResponsePayload(String response, List<SourceInfo> sources) {
            this.response = response;
            this.sources = sources;
        }
    }

    static class SourceInfo {
        String title;
        String type;

        SourceInfo(String title, String type) {
            this.title = title;
            this.type = type;
        }
    }

    static class ErrorResponse {
        String error;

        ErrorResponse(String error) {
            this.error = error;
        }
    }

    public static void start(int port) throws Exception {
        TokenManager.validateCredentials(CLIENT_ID, CLIENT_SECRET);

        TokenManager tm = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL, httpClient);

        Path frontendDir = Path.of(".", "..", "frontend-example", "simple-html").toAbsolutePath().normalize();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // API: Basic search
        server.createContext("/api/search", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            exchange.getResponseHeaders().set("Content-Type", "application/json");

            Map<String, String> params = parseQuery(exchange.getRequestURI().getQuery());
            String q = params.get("q");

            if (q == null || q.isEmpty()) {
                sendJson(exchange, 400, gson.toJson(new ErrorResponse("Query parameter 'q' is required")));
                return;
            }

            int limit = 10;
            if (params.containsKey("limit")) {
                try {
                    limit = Integer.parseInt(params.get("limit"));
                } catch (NumberFormatException ignored) {
                }
            }

            try {
                Main.SearchResponse results = Main.search(tm, q, limit);
                sendJson(exchange, 200, gson.toJson(results));
            } catch (Exception e) {
                System.err.println("Search error: " + e.getMessage());
                sendJson(exchange, 500, gson.toJson(new ErrorResponse("Search request failed")));
            }
        });

        // API: RAG search
        server.createContext("/api/search/rag", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            exchange.getResponseHeaders().set("Content-Type", "application/json");

            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            RAGRequest ragReq = gson.fromJson(body, RAGRequest.class);

            if (ragReq == null || ragReq.query == null || ragReq.query.isEmpty()) {
                sendJson(exchange, 400, gson.toJson(new ErrorResponse("Field 'query' is required")));
                return;
            }

            int limit = ragReq.limit > 0 ? ragReq.limit : 5;

            try {
                // Step 1: Search
                Main.SearchResponse results = Main.search(tm, ragReq.query, limit);

                if (results.data == null || results.data.isEmpty()) {
                    sendJson(exchange, 200,
                            gson.toJson(new RAGResponsePayload("No relevant content found.", List.of())));
                    return;
                }

                // Step 2: Extract snippets and format context
                List<Main.Snippet> snippets = Main.extractSnippets(results, limit, 500);
                String context = Main.formatContextForLLM(snippets);

                // Step 3: Generate response
                String generatedResponse = Main.generateWithContext(tm, ragReq.query, context, ragReq.systemPrompt);

                List<SourceInfo> sources = snippets.stream()
                        .map(s -> new SourceInfo(s.title, s.type))
                        .collect(Collectors.toList());

                sendJson(exchange, 200, gson.toJson(new RAGResponsePayload(generatedResponse, sources)));
            } catch (Exception e) {
                System.err.println("RAG error: " + e.getMessage());
                sendJson(exchange, 500, gson.toJson(new ErrorResponse("RAG request failed")));
            }
        });

        // Serve frontend static files
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/") || path.isEmpty()) {
                path = "/index.html";
            }

            Path filePath = frontendDir.resolve(path.substring(1)).normalize();

            if (Files.exists(filePath) && Files.isRegularFile(filePath) && filePath.startsWith(frontendDir)) {
                String contentType = getContentType(filePath.toString());
                exchange.getResponseHeaders().set("Content-Type", contentType);
                byte[] fileBytes = Files.readAllBytes(filePath);
                exchange.sendResponseHeaders(200, fileBytes.length);
                exchange.getResponseBody().write(fileBytes);
                exchange.getResponseBody().close();
            } else {
                sendJson(exchange, 404, gson.toJson(new ErrorResponse("Not found")));
            }
        });

        server.setExecutor(null);
        server.start();

        System.out.printf("Search API proxy server running at http://localhost:%d%n", port);
        System.out.printf("Frontend available at http://localhost:%d%n", port);
        System.out.printf("%nAPI endpoints:%n");
        System.out.printf("  GET  http://localhost:%d/api/search?q=your+query&limit=10%n", port);
        System.out.printf("  POST http://localhost:%d/api/search/rag%n", port);
    }

    private static void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }

    private static Map<String, String> parseQuery(String query) {
        if (query == null || query.isEmpty()) return Map.of();
        Map<String, String> params = new HashMap<>();
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                params.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                        URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
            }
        }
        return params;
    }

    private static String getContentType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
