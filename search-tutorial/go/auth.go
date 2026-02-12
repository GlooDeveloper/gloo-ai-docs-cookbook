// Gloo AI Search API - Authentication
//
// OAuth2 token management for Gloo AI API authentication.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// TokenInfo holds OAuth2 token data.
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

// TokenManager manages OAuth2 token lifecycle.
type TokenManager struct {
	ClientID     string
	ClientSecret string
	TokenURL     string
	tokenInfo    *TokenInfo
}

// NewTokenManager creates a new TokenManager.
func NewTokenManager(clientID, clientSecret, tokenURL string) *TokenManager {
	return &TokenManager{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		TokenURL:     tokenURL,
	}
}

// GetAccessToken retrieves a new access token from the OAuth2 endpoint.
func (tm *TokenManager) GetAccessToken() (*TokenInfo, error) {
	body := strings.NewReader("grant_type=client_credentials&scope=api/access")

	req, err := http.NewRequest("POST", tm.TokenURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(tm.ClientID, tm.ClientSecret)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to obtain access token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to obtain access token: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var tokenData TokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenData); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	tokenData.ExpiresAt = time.Now().Unix() + int64(tokenData.ExpiresIn)
	tm.tokenInfo = &tokenData
	return &tokenData, nil
}

// IsTokenExpired checks if the token is expired or close to expiring.
func (tm *TokenManager) IsTokenExpired() bool {
	if tm.tokenInfo == nil {
		return true
	}
	return time.Now().Unix() > (tm.tokenInfo.ExpiresAt - 60)
}

// EnsureValidToken ensures we have a valid access token and returns it.
func (tm *TokenManager) EnsureValidToken() (string, error) {
	if tm.IsTokenExpired() {
		if _, err := tm.GetAccessToken(); err != nil {
			return "", err
		}
	}
	return tm.tokenInfo.AccessToken, nil
}

// ValidateCredentials checks that required credentials are set.
func ValidateCredentials(clientID, clientSecret string) {
	if clientID == "" || clientSecret == "" ||
		clientID == "YOUR_CLIENT_ID" || clientSecret == "YOUR_CLIENT_SECRET" {
		fmt.Fprintln(os.Stderr, "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
		fmt.Println("Create a .env file with your credentials:")
		fmt.Println("GLOO_CLIENT_ID=your_client_id_here")
		fmt.Println("GLOO_CLIENT_SECRET=your_client_secret_here")
		fmt.Println("GLOO_TENANT=your_tenant_name_here")
		os.Exit(1)
	}
}
