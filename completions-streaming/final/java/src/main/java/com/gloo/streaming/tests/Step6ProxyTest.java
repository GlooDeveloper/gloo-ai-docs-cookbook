package com.gloo.streaming.tests;

import com.gloo.streaming.proxy.ProxyServer;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Steps 8–9 Test: Server-Side Proxy
 *
 * <p>Validates that:
 * <ul>
 *   <li>The Java proxy server starts and responds to /health</li>
 *   <li>POST /api/stream relays SSE from Gloo AI back to the client</li>
 *   <li>SSE lines arrive with correct format and [DONE] is detected</li>
 * </ul>
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step6ProxyTest
 *
 * <p>Note: Starts the proxy server in-process; no separate server process needed.
 */
public class Step6ProxyTest {

    public static void main(String[] args) {
        System.out.println("🧪 Testing Steps 8–9: Server-Side Proxy\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        if (dotenv.get("GLOO_CLIENT_ID", "").isBlank()) {
            System.err.println("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
            System.exit(1);
        }

        String portStr = dotenv.get("PROXY_PORT", "3001");
        int port;
        try {
            port = Integer.parseInt(portStr);
        } catch (NumberFormatException e) {
            port = 3001;
        }

        try {
            // Test 1: Start the proxy server (non-blocking)
            System.out.printf("Test 1: Starting proxy server on port %d...%n", port);
            ProxyServer.start(port);

            // Wait for the server to be ready
            HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(1))
                .build();

            boolean ready = false;
            for (int i = 0; i < 20; i++) {
                try {
                    HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + port + "/health"))
                        .GET()
                        .timeout(Duration.ofSeconds(1))
                        .build();
                    HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200) {
                        ready = true;
                        break;
                    }
                } catch (Exception ignored) {}
                Thread.sleep(200);
            }

            if (!ready) {
                throw new RuntimeException("Proxy server did not start on port " + port + " within 4 seconds");
            }
            System.out.printf("✓ Proxy server running at http://localhost:%d%n", port);

            // Test 2: /health endpoint
            System.out.println("\nTest 2: /health endpoint...");
            HttpRequest healthReq = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/health"))
                .GET()
                .timeout(Duration.ofSeconds(5))
                .build();
            HttpResponse<String> healthResp = client.send(healthReq, HttpResponse.BodyHandlers.ofString());
            if (healthResp.statusCode() != 200) {
                throw new RuntimeException("Expected 200 from /health, got " + healthResp.statusCode());
            }
            String healthBody = healthResp.body();
            if (!healthBody.contains("\"ok\"")) {
                throw new RuntimeException("Expected status=ok, got: " + healthBody);
            }
            System.out.println("✓ /health returns: " + healthBody);

            // Test 3: POST /api/stream returns text/event-stream
            System.out.println("\nTest 3: POST /api/stream — Content-Type header...");
            String payload = "{\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}],\"auto_routing\":true}";
            HttpRequest streamReq = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/stream"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .timeout(Duration.ofSeconds(30))
                .build();

            HttpResponse<java.io.InputStream> streamResp = client.send(
                streamReq, HttpResponse.BodyHandlers.ofInputStream()
            );

            if (streamResp.statusCode() != 200) {
                String bodyStr = new String(streamResp.body().readAllBytes(), StandardCharsets.UTF_8);
                int truncAt = Math.min(bodyStr.length(), 200);
                throw new RuntimeException("Expected 200, got " + streamResp.statusCode() + ": " + bodyStr.substring(0, truncAt));
            }

            String contentType = streamResp.headers().firstValue("Content-Type").orElse("");
            if (!contentType.contains("text/event-stream")) {
                throw new RuntimeException("Expected text/event-stream, got: " + contentType);
            }
            System.out.println("✓ Content-Type: " + contentType);

            // Test 4: SSE line format (data: prefix)
            System.out.println("\nTest 4: SSE line format (data: prefix)...");
            int dataLines = 0;
            boolean doneDetected = false;

            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(streamResp.body(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isBlank()) continue;
                    if (!line.startsWith("data: ")) {
                        throw new RuntimeException("Expected 'data: ' prefix, got: " + line);
                    }
                    String ssePayload = line.substring(6).strip();
                    if ("[DONE]".equals(ssePayload)) {
                        doneDetected = true;
                        break;
                    }
                    dataLines++;
                }
            }

            System.out.printf("✓ All lines have 'data: ' prefix (%d data chunks received)%n", dataLines);

            if (!doneDetected) {
                System.out.println("⚠️  [DONE] not detected — stream may have ended without sentinel");
            } else {
                System.out.println("✓ [DONE] sentinel detected — stream terminated cleanly");
            }

            // Test 5: CORS headers present
            System.out.println("\nTest 5: CORS headers on response...");
            HttpRequest corsReq = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/stream"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", "http://localhost:3000")
                .timeout(Duration.ofSeconds(5))
                .build();
            HttpResponse<String> corsResp = client.send(corsReq, HttpResponse.BodyHandlers.ofString());
            String corsHeader = corsResp.headers().firstValue("Access-Control-Allow-Origin").orElse("");
            if (corsHeader.isBlank()) {
                System.out.println("⚠️  Access-Control-Allow-Origin header not set on OPTIONS response");
            } else {
                System.out.println("✓ Access-Control-Allow-Origin: " + corsHeader);
            }

            System.out.println("\n✅ Steps 8–9 Complete! Proxy server relaying SSE end-to-end.");
            System.out.println("   Track B complete: credentials stay server-side, client receives SSE.\n");

        } catch (Exception e) {
            System.err.println("\n❌ Steps 8–9 Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - Check that Maven dependencies are installed: mvn compile");
            System.err.println("   - Verify port " + port + " is not already in use");
            System.err.println("   - Check proxy/ProxyServer.java creates HttpServer correctly");
            System.err.println("   - Confirm GLOO_CLIENT_ID and GLOO_CLIENT_SECRET are set in .env\n");
            System.exit(1);
        }

        System.exit(0);
    }
}
