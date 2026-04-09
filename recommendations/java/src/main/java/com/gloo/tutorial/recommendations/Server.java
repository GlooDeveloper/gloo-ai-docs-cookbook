package com.gloo.tutorial.recommendations;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.lang.reflect.Type;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;

/**
 * Gloo AI Recommendations API - Proxy Server (Java HttpServer)
 *
 * A lightweight HTTP server that proxies recommendation requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Start with:
 *   mvn exec:java -Dexec.args="server"
 *
 * Endpoints:
 *   POST /api/recommendations/base       - Publisher-scoped recommendations (metadata only)
 *   POST /api/recommendations/verbose    - Publisher-scoped recommendations (with snippet text)
 *   POST /api/recommendations/affiliates - Cross-publisher affiliate network recommendations
 */
public class Server {

    static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    static final Gson gson = new Gson();

    static class RecommendRequestBody {
        String query;
        Object item_count;
    }

    static class ErrorResponse {
        String error;
        ErrorResponse(String error) { this.error = error; }
    }

    public static void start(int port) throws Exception {
        TokenManager.validateCredentials(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET);

        TokenManager tm = new TokenManager(AppConfig.CLIENT_ID, AppConfig.CLIENT_SECRET,
                AppConfig.TOKEN_URL, httpClient);

        Path frontendDir = Path.of(".", "..", "frontend-example", "simple-html").toAbsolutePath().normalize();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // POST /api/recommendations/base
        server.createContext("/api/recommendations/base", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            RecommendRequestBody body = parseBody(exchange);
            if (body == null) return;

            int itemCount = resolveItemCount(body.item_count, AppConfig.DEFAULT_ITEM_COUNT);

            try {
                var items = Main.getBase(tm, body.query, itemCount);
                sendJson(exchange, 200, gson.toJson(items));
            } catch (Exception e) {
                System.err.println("Base recommendations error: " + e.getMessage());
                sendJson(exchange, 500, gson.toJson(new ErrorResponse("Base recommendations request failed")));
            }
        });

        // POST /api/recommendations/verbose
        server.createContext("/api/recommendations/verbose", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            RecommendRequestBody body = parseBody(exchange);
            if (body == null) return;

            int itemCount = resolveItemCount(body.item_count, AppConfig.DEFAULT_ITEM_COUNT);

            try {
                var items = Main.getVerbose(tm, body.query, itemCount);
                sendJson(exchange, 200, gson.toJson(items));
            } catch (Exception e) {
                System.err.println("Verbose recommendations error: " + e.getMessage());
                sendJson(exchange, 500, gson.toJson(new ErrorResponse("Verbose recommendations request failed")));
            }
        });

        // POST /api/recommendations/affiliates
        server.createContext("/api/recommendations/affiliates", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            RecommendRequestBody body = parseBody(exchange);
            if (body == null) return;

            int itemCount = resolveItemCount(body.item_count, AppConfig.DEFAULT_ITEM_COUNT);

            try {
                var items = Main.getReferencedItems(tm, body.query, itemCount);
                sendJson(exchange, 200, gson.toJson(items));
            } catch (Exception e) {
                System.err.println("Affiliates error: " + e.getMessage());
                sendJson(exchange, 500, gson.toJson(new ErrorResponse("Affiliates request failed")));
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

        System.out.printf("Recommendations API proxy server running at http://localhost:%d%n", port);
        System.out.printf("Open http://localhost:%d in your browser%n", port);
        System.out.println("Press Ctrl+C to stop.");
    }

    /**
     * Reads and validates the JSON request body. Sends 400 and returns null on failure.
     */
    private static RecommendRequestBody parseBody(HttpExchange exchange) throws IOException {
        String bodyStr = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        RecommendRequestBody body = gson.fromJson(bodyStr, RecommendRequestBody.class);

        if (body == null || body.query == null || body.query.isEmpty()) {
            sendJson(exchange, 400, gson.toJson(new ErrorResponse("Field 'query' is required")));
            return null;
        }
        return body;
    }

    /**
     * Resolves item_count from the request body (Gson deserializes JSON numbers as Double).
     */
    private static int resolveItemCount(Object raw, int defaultValue) {
        if (raw == null) return defaultValue;
        String s = raw instanceof Double ? String.valueOf(((Double) raw).intValue()) : raw.toString();
        return AppConfig.parseItemCount(s, defaultValue);
    }

    private static void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }

    private static String getContentType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css"))  return "text/css";
        if (path.endsWith(".js"))   return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png"))  return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".svg"))  return "image/svg+xml";
        return "application/octet-stream";
    }
}
