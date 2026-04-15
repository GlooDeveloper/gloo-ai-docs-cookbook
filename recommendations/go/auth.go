package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TokenInfo holds the access token and its expiration time.
type TokenInfo struct {
	AccessToken string
	ExpiresAt   time.Time
}

// TokenManager handles OAuth2 client credentials token lifecycle.
type TokenManager struct {
	clientID     string
	clientSecret string
	tokenURL     string
	tokenInfo    *TokenInfo
}

// NewTokenManager creates a new TokenManager.
func NewTokenManager(clientID, clientSecret, tokenURL string) *TokenManager {
	return &TokenManager{
		clientID:     clientID,
		clientSecret: clientSecret,
		tokenURL:     tokenURL,
	}
}

// GetAccessToken fetches a new token from the token URL.
func (tm *TokenManager) GetAccessToken() (*TokenInfo, error) {
	payload := fmt.Sprintf(
		"grant_type=client_credentials&client_id=%s&client_secret=%s",
		tm.clientID, tm.clientSecret,
	)

	resp, err := http.Post(tm.tokenURL, "application/x-www-form-urlencoded", bytes.NewBufferString(payload))
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	token, ok := result["access_token"].(string)
	if !ok || token == "" {
		return nil, fmt.Errorf("access_token missing from token response")
	}

	expiresIn := 3600.0
	if val, ok := result["expires_in"].(float64); ok {
		expiresIn = val
	}

	return &TokenInfo{
		AccessToken: token,
		ExpiresAt:   time.Now().Add(time.Duration(expiresIn) * time.Second),
	}, nil
}

// IsTokenExpired returns true if the token is missing or expires within 60 seconds.
func (tm *TokenManager) IsTokenExpired() bool {
	if tm.tokenInfo == nil {
		return true
	}
	return time.Now().After(tm.tokenInfo.ExpiresAt.Add(-60 * time.Second))
}

// EnsureValidToken returns a valid access token, refreshing if necessary.
func (tm *TokenManager) EnsureValidToken() (string, error) {
	if tm.IsTokenExpired() {
		info, err := tm.GetAccessToken()
		if err != nil {
			return "", err
		}
		tm.tokenInfo = info
	}
	return tm.tokenInfo.AccessToken, nil
}

// ValidateCredentials exits if credentials look like placeholder values.
func ValidateCredentials(clientID, clientSecret string) {
	placeholders := []string{"your_client_id_here", "your_client_secret_here", ""}
	for _, p := range placeholders {
		if strings.EqualFold(clientID, p) || strings.EqualFold(clientSecret, p) {
			fmt.Println("Error: Please set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET in your .env file.")
			fmt.Println("Get your credentials from the API Credentials page in Gloo AI Studio.")
			panic("invalid credentials")
		}
	}
}
