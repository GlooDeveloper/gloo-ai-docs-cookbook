package com.gloo.streaming.auth;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import io.github.cdimascio.dotenv.Dotenv;

/**
 * Token manager for Gloo AI OAuth2 authentication.
 *
 * <p>Handles client credentials grant type with automatic token refresh.
 * Caches the token in static state and refreshes it 5 minutes before expiry.
 */
public class TokenManager {

    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final Gson GSON = new Gson();

    private static String accessToken = null;
    private static Instant tokenExpiry = null;

    /**
     * Retrieve an OAuth2 access token from Gloo AI.
     *
     * <p>Uses the client credentials grant type with GLOO_CLIENT_ID and
     * GLOO_CLIENT_SECRET from environment variables.
     *
     * @return Map containing access_token, expires_in, and token_type
     * @throws RuntimeException if credentials are missing or the request fails
     */
    public static Map<String, Object> getAccessToken() {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        String clientId = dotenv.get("GLOO_CLIENT_ID", System.getenv("GLOO_CLIENT_ID") != null ? System.getenv("GLOO_CLIENT_ID") : "");
        String clientSecret = dotenv.get("GLOO_CLIENT_SECRET", System.getenv("GLOO_CLIENT_SECRET") != null ? System.getenv("GLOO_CLIENT_SECRET") : "");

        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new RuntimeException(
                "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables."
            );
        }

        String formBody = "grant_type=client_credentials"
            + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
            + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(TOKEN_URL))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .build();

        try {
            HttpResponse<String> response = HTTP_CLIENT.send(
                request, HttpResponse.BodyHandlers.ofString()
            );
            if (response.statusCode() != 200) {
                throw new RuntimeException(
                    "Failed to get access token: HTTP " + response.statusCode()
                );
            }
            Map<String, Object> tokenData = GSON.fromJson(
                response.body(), new TypeToken<Map<String, Object>>() {}.getType()
            );
            if (!tokenData.containsKey("access_token")) {
                throw new RuntimeException("Invalid token response from server");
            }
            return tokenData;
        } catch (Exception e) {
            if (e instanceof RuntimeException re) throw re;
            throw new RuntimeException("Failed to get access token: " + e.getMessage(), e);
        }
    }

    /**
     * Ensure we have a valid access token, refreshing if necessary.
     *
     * <p>Thread-safe: synchronizes on the class. Refreshes the token
     * 5 minutes before expiry.
     *
     * @return Valid access token string
     */
    public static synchronized String ensureValidToken() {
        Instant now = Instant.now();

        if (accessToken == null || tokenExpiry == null || now.isAfter(tokenExpiry)) {
            Map<String, Object> tokenData = getAccessToken();
            accessToken = (String) tokenData.get("access_token");
            // expires_in comes back as Double from Gson
            double expiresIn = tokenData.containsKey("expires_in")
                ? ((Number) tokenData.get("expires_in")).doubleValue()
                : 3600.0;
            // Set expiry with 5-minute buffer
            tokenExpiry = now.plusSeconds((long) expiresIn - 300);
        }

        return accessToken;
    }
}
