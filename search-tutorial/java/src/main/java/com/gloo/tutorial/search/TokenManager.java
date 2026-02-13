package com.gloo.tutorial.search;

import com.google.gson.Gson;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * Manages OAuth2 token lifecycle for Gloo AI API authentication.
 */
public class TokenManager {

    private final String clientId;
    private final String clientSecret;
    private final String tokenUrl;
    private final HttpClient httpClient;
    private final Gson gson = new Gson();
    private TokenInfo tokenInfo;

    static class TokenInfo {
        String access_token;
        int expires_in;
        long expires_at;
        String token_type;
    }

    public TokenManager(String clientId, String clientSecret, String tokenUrl, HttpClient httpClient) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.tokenUrl = tokenUrl;
        this.httpClient = httpClient;
    }

    /**
     * Retrieves a new access token from the OAuth2 endpoint.
     */
    public TokenInfo getAccessToken() throws IOException, InterruptedException {
        String auth = clientId + ":" + clientSecret;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        String requestBody = "grant_type=client_credentials&scope=api/access";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUrl))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("Failed to obtain access token: HTTP " + response.statusCode());
        }

        tokenInfo = gson.fromJson(response.body(), TokenInfo.class);
        tokenInfo.expires_at = Instant.now().getEpochSecond() + tokenInfo.expires_in;
        return tokenInfo;
    }

    /**
     * Checks if the token is expired or close to expiring.
     */
    public boolean isTokenExpired() {
        if (tokenInfo == null) return true;
        return Instant.now().getEpochSecond() > (tokenInfo.expires_at - 60);
    }

    /**
     * Ensures we have a valid access token and returns it.
     */
    public String ensureValidToken() throws IOException, InterruptedException {
        if (isTokenExpired()) {
            getAccessToken();
        }
        return tokenInfo.access_token;
    }

    /**
     * Validates that required credentials are set.
     */
    public static void validateCredentials(String clientId, String clientSecret) {
        if (clientId == null || clientSecret == null ||
                clientId.isEmpty() || clientSecret.isEmpty() ||
                "YOUR_CLIENT_ID".equals(clientId) || "YOUR_CLIENT_SECRET".equals(clientSecret)) {
            System.err.println("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set");
            System.out.println("Create a .env file with your credentials:");
            System.out.println("GLOO_CLIENT_ID=your_client_id_here");
            System.out.println("GLOO_CLIENT_SECRET=your_client_secret_here");
            System.out.println("GLOO_TENANT=your_tenant_name_here");
            System.exit(1);
        }
    }
}
