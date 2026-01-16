package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Configuration
var (
	clientID     string
	clientSecret string
	tokenURL     = "https://platform.ai.gloo.com/oauth2/token"
	apiURL       = "https://platform.ai.gloo.com/ai/v1/chat/completions"
)

// TokenInfo represents the OAuth2 token response
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

// ChatMessage represents a chat message
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest represents the request payload
type ChatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

// ChatCompletionResponse represents the API response
type ChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Global token storage
var tokenInfo *TokenInfo

// getEnv returns environment variable or default value
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// getAccessToken retrieves a new access token from the Gloo AI API
func getAccessToken() (*TokenInfo, error) {
	data := strings.NewReader("grant_type=client_credentials&scope=api/access")
	req, err := http.NewRequest("POST", tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get token: %s - %s", resp.Status, string(body))
	}

	var token TokenInfo
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	token.ExpiresAt = time.Now().Unix() + int64(token.ExpiresIn)
	return &token, nil
}

// isTokenExpired checks if the token is expired or close to expiring
func isTokenExpired(token *TokenInfo) bool {
	if token == nil || token.ExpiresAt == 0 {
		return true
	}
	return time.Now().Unix() > (token.ExpiresAt - 60)
}

// ensureValidToken ensures we have a valid access token
func ensureValidToken() (string, error) {
	if isTokenExpired(tokenInfo) {
		fmt.Println("Getting new access token...")
		var err error
		tokenInfo, err = getAccessToken()
		if err != nil {
			return "", fmt.Errorf("failed to get access token: %w", err)
		}
	}
	return tokenInfo.AccessToken, nil
}

// makeAuthenticatedRequest makes an authenticated API request
func makeAuthenticatedRequest(endpoint string, payload interface{}) (*ChatCompletionResponse, error) {
	token, err := ensureValidToken()
	if err != nil {
		return nil, err
	}

	var reqBody []byte
	if payload != nil {
		reqBody, err = json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API call failed: %s - %s", resp.Status, string(body))
	}

	var response ChatCompletionResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// testAuthentication tests the authentication implementation
func testAuthentication() bool {
	fmt.Println("=== Gloo AI Authentication Test ===\n")

	// Test 1: Token retrieval
	fmt.Println("1. Testing token retrieval...")
	tokenInfo, err := getAccessToken()
	if err != nil {
		fmt.Printf("   ✗ Token retrieval failed: %v\n", err)
		return false
	}

	fmt.Println("   ✓ Token retrieved successfully")
	fmt.Printf("   Token type: %s\n", tokenInfo.TokenType)
	fmt.Printf("   Expires in: %d seconds\n\n", tokenInfo.ExpiresIn)

	// Test 2: Token validation
	fmt.Println("2. Testing token validation...")
	token, err := ensureValidToken()
	if err != nil {
		fmt.Printf("   ✗ Token validation failed: %v\n", err)
		return false
	}
	_ = token // Use the token variable
	fmt.Println("   ✓ Token validation successful\n")

	// Test 3: API call with authentication
	fmt.Println("3. Testing authenticated API call...")
	request := ChatCompletionRequest{
		Model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
		Messages: []ChatMessage{
			{Role: "user", Content: "Hello! This is a test of the authentication system."},
		},
	}

	result, err := makeAuthenticatedRequest(apiURL, request)
	if err != nil {
		fmt.Printf("   ✗ API call failed: %v\n", err)
		return false
	}

	fmt.Println("   ✓ API call successful")
	content := result.Choices[0].Message.Content
	if len(content) > 100 {
		content = content[:100] + "..."
	}
	fmt.Printf("   Response: %s\n\n", content)

	fmt.Println("=== All tests passed! ===")
	return true
}

// main is the entry point
func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		fmt.Println("No .env file found, using environment variables")
	}

	// Set configuration
	clientID = getEnv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")

	if clientID == "YOUR_CLIENT_ID" || clientSecret == "YOUR_CLIENT_SECRET" {
		fmt.Println("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables")
		fmt.Println("You can create a .env file with:")
		fmt.Println("GLOO_CLIENT_ID=your_client_id")
		fmt.Println("GLOO_CLIENT_SECRET=your_client_secret")
		return
	}

	testAuthentication()
}