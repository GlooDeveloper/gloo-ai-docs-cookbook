// Package auth provides OAuth2 token management for Gloo AI.
package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"
)

const tokenURL = "https://platform.ai.gloo.com/oauth2/token"

// tokenState holds the cached access token and its expiry.
var (
	mu          sync.Mutex
	accessToken string
	tokenExpiry time.Time
)

// TokenResponse represents the OAuth2 token endpoint response.
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

// GetAccessToken retrieves an OAuth2 access token from Gloo AI using
// the client credentials grant type.
//
// Reads GLOO_CLIENT_ID and GLOO_CLIENT_SECRET from environment variables.
func GetAccessToken() (*TokenResponse, error) {
	clientID := os.Getenv("GLOO_CLIENT_ID")
	clientSecret := os.Getenv("GLOO_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf(
			"missing credentials: set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables",
		)
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request failed with status %d: %s", resp.StatusCode, body)
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &tokenResp, nil
}

// EnsureValidToken returns a valid access token, refreshing if necessary.
//
// Thread-safe: uses a mutex to protect cached token state.
// Refreshes the token 5 minutes before expiry.
func EnsureValidToken() (string, error) {
	mu.Lock()
	defer mu.Unlock()

	if accessToken == "" || time.Now().After(tokenExpiry) {
		tokenData, err := GetAccessToken()
		if err != nil {
			return "", err
		}
		accessToken = tokenData.AccessToken
		expiresIn := tokenData.ExpiresIn
		if expiresIn == 0 {
			expiresIn = 3600
		}
		// Set expiry with 5-minute buffer
		tokenExpiry = time.Now().Add(time.Duration(expiresIn-300) * time.Second)
	}

	return accessToken, nil
}
