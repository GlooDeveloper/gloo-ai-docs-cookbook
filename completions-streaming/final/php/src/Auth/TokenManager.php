<?php

declare(strict_types=1);

namespace GlooStreaming\Auth;

/**
 * Token manager for Gloo AI OAuth2 authentication.
 *
 * Handles client credentials grant type with automatic token refresh.
 * Caches the token as static state and refreshes it 5 minutes before expiry.
 */
class TokenManager
{
    private const TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';

    private static ?string $accessToken = null;
    private static ?int $tokenExpiry = null;

    /**
     * Retrieve an OAuth2 access token from Gloo AI.
     *
     * Uses the client credentials grant type with GLOO_CLIENT_ID and
     * GLOO_CLIENT_SECRET from environment variables.
     *
     * @return array{access_token: string, expires_in: int, token_type: string}
     * @throws \RuntimeException If credentials are missing or the request fails
     */
    public static function getAccessToken(): array
    {
        $clientId = $_ENV['GLOO_CLIENT_ID'] ?? getenv('GLOO_CLIENT_ID');
        $clientSecret = $_ENV['GLOO_CLIENT_SECRET'] ?? getenv('GLOO_CLIENT_SECRET');

        if (!$clientId || !$clientSecret) {
            throw new \RuntimeException(
                'Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables.'
            );
        }

        $ch = curl_init(self::TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'client_credentials',
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);

        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException("Failed to get access token: {$error}");
        }
        if ($status !== 200) {
            throw new \RuntimeException("Failed to get access token: HTTP {$status}");
        }

        $data = json_decode($body, true);
        if (!$data || !isset($data['access_token'])) {
            throw new \RuntimeException('Invalid token response from server');
        }

        return $data;
    }

    /**
     * Ensure we have a valid access token, refreshing if necessary.
     *
     * @return string Valid access token
     */
    public static function ensureValidToken(): string
    {
        $now = time();

        if (self::$accessToken === null || self::$tokenExpiry === null || $now >= self::$tokenExpiry) {
            $tokenData = self::getAccessToken();
            self::$accessToken = $tokenData['access_token'];
            // Set expiry with 5-minute buffer
            $expiresIn = $tokenData['expires_in'] ?? 3600;
            self::$tokenExpiry = $now + $expiresIn - 300;
        }

        return self::$accessToken;
    }
}
