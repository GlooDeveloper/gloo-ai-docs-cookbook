<?php
/**
 * Gloo AI Search API - Authentication
 *
 * OAuth2 token management for Gloo AI API authentication.
 */

declare(strict_types=1);

class TokenManager
{
    private string $clientId;
    private string $clientSecret;
    private string $tokenUrl;
    private array $tokenInfo = [];

    public function __construct(string $clientId, string $clientSecret, string $tokenUrl)
    {
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->tokenUrl = $tokenUrl;
    }

    public function getAccessToken(): array
    {
        $postData = 'grant_type=client_credentials&scope=api/access';

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->tokenUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_USERPWD, $this->clientId . ':' . $this->clientSecret);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $result = curl_exec($ch);

        if (curl_errno($ch)) {
            throw new Exception('Failed to obtain access token: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception('Failed to obtain access token: HTTP ' . $httpCode);
        }

        $tokenData = json_decode($result, true);
        $tokenData['expires_at'] = time() + $tokenData['expires_in'];
        $this->tokenInfo = $tokenData;

        return $tokenData;
    }

    public function isTokenExpired(): bool
    {
        if (empty($this->tokenInfo) || !isset($this->tokenInfo['expires_at'])) {
            return true;
        }
        return time() > ($this->tokenInfo['expires_at'] - 60);
    }

    public function ensureValidToken(): string
    {
        if ($this->isTokenExpired()) {
            $this->getAccessToken();
        }
        return $this->tokenInfo['access_token'];
    }
}

function validateCredentials(string $clientId, string $clientSecret): void
{
    if (
        empty($clientId) || empty($clientSecret) ||
        $clientId === 'YOUR_CLIENT_ID' || $clientSecret === 'YOUR_CLIENT_SECRET'
    ) {
        fwrite(STDERR, "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set\n");
        echo "Create a .env file with your credentials:\n";
        echo "GLOO_CLIENT_ID=your_client_id_here\n";
        echo "GLOO_CLIENT_SECRET=your_client_secret_here\n";
        echo "GLOO_TENANT=your_tenant_name_here\n";
        exit(1);
    }
}
