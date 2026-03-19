package com.gloo.streaming.proxy;

import com.google.gson.Gson;
import com.gloo.streaming.auth.TokenManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * HTTP proxy server that relays SSE streams from the Gloo AI completions API
 * to browser clients.
 *
 * <p>Uses {@code com.sun.net.httpserver.HttpServer} with chunked transfer
 * encoding so browsers receive tokens as they arrive. This avoids exposing
 * API credentials in the browser.
 *
 * <p>Start the server: {@code ProxyServer.start(3001);}
 */
public class ProxyServer {

    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final Gson GSON = new Gson();

    /**
     * Start the proxy HTTP server on the given port.
     *
     * @param port TCP port to listen on
     * @throws Exception if the server cannot start
     */
    public static void start(int port) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/stream", new StreamHandler());
        server.createContext("/health", new HealthHandler());
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        System.out.println("Proxy server running at http://localhost:" + port);
    }

    /** Handles POST /api/stream — relays SSE upstream to the client. */
    static class StreamHandler implements HttpHandler {

        private final String corsOrigin;

        StreamHandler() {
            String env = System.getenv("PROXY_CORS_ORIGIN");
            this.corsOrigin = (env != null && !env.isBlank()) ? env : "http://localhost:3000";
        }

        @Override
        public void handle(HttpExchange exchange) {
            try {
                // CORS headers
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", corsOrigin);
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");

                if ("OPTIONS".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }
                if (!"POST".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(405, -1);
                    return;
                }

                // SSE headers
                exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
                exchange.getResponseHeaders().add("Cache-Control", "no-cache");
                exchange.getResponseHeaders().add("X-Accel-Buffering", "no");
                // 0 = chunked transfer encoding
                exchange.sendResponseHeaders(200, 0);

                OutputStream out = exchange.getResponseBody();

                try {
                    String authToken = TokenManager.ensureValidToken();
                    String rawBody = new String(
                        exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8
                    );

                    @SuppressWarnings("unchecked")
                    Map<String, Object> body = GSON.fromJson(rawBody, Map.class);
                    if (body == null) body = new java.util.HashMap<>();
                    body.put("stream", true);

                    String payload = GSON.toJson(body);

                    HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(API_URL))
                        .header("Authorization", "Bearer " + authToken)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload))
                        .build();

                    HttpResponse<java.io.InputStream> upstream = HTTP_CLIENT.send(
                        request, HttpResponse.BodyHandlers.ofInputStream()
                    );

                    if (upstream.statusCode() != 200) {
                        String errMsg = "data: {\"error\": \"API error " + upstream.statusCode() + "\"}\n\n";
                        out.write(errMsg.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                        return;
                    }

                    try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(upstream.body(), StandardCharsets.UTF_8)
                    )) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (!line.isBlank()) {
                                String sseFrame = line + "\n\n";
                                out.write(sseFrame.getBytes(StandardCharsets.UTF_8));
                                out.flush();
                            }
                        }
                    }
                } catch (Exception e) {
                    String errMsg = "data: {\"error\": \"" + e.getMessage().replace("\"", "'") + "\"}\n\n";
                    try {
                        out.write(errMsg.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    } catch (Exception ignored) {}
                } finally {
                    out.close();
                }
            } catch (Exception e) {
                System.err.println("Handler error: " + e.getMessage());
            }
        }
    }

    /** Handles GET /health — returns a simple status JSON. */
    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                byte[] response = "{\"status\":\"ok\",\"service\":\"completions-streaming-proxy\"}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.length);
                exchange.getResponseBody().write(response);
                exchange.getResponseBody().close();
            } catch (Exception e) {
                System.err.println("Health check error: " + e.getMessage());
            }
        }
    }
}
