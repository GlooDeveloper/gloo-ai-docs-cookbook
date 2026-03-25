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

    public static void main(String[] args) throws Exception {
        io.github.cdimascio.dotenv.Dotenv dotenv =
            io.github.cdimascio.dotenv.Dotenv.configure().ignoreIfMissing().load();
        String portStr = dotenv.get("PROXY_PORT", "3001");
        int port = Integer.parseInt(portStr);
        start(port);
        // Block the main thread so the server stays alive
        Thread.currentThread().join();
    }

    /**
     * Start the proxy HTTP server on the given port (non-blocking).
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
            // TODO: Implement the Java SSE proxy handler (Step 8):
            // 1. Add CORS headers and handle OPTIONS preflight requests
            // 2. Reject non-POST requests with a 405 response
            // 3. Set SSE response headers and send the 200 response code to begin streaming
            // 4. Retrieve the server-side auth token and read the incoming request body
            // 5. Forward the request upstream with stream set to true and handle non-200 upstream responses
            // 6. Read the upstream SSE stream line by line and write each non-blank line to the client
            // 7. Flush after each line and close the output stream in a finally block
            try { exchange.sendResponseHeaders(501, -1); } catch (Exception ignored) {}
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
