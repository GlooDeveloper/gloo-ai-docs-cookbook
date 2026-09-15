package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Configuration
var (
	apiKey string
	apiURL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"
)

// ChatMessage represents a chat message
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest represents the request payload
type ChatCompletionRequest struct {
	AutoRouting bool          `json:"auto_routing"`
	Messages    []ChatMessage `json:"messages"`
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

// getEnv returns environment variable or default value
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// validateCredentials checks that the required API key is configured
func validateCredentials() bool {
	if apiKey == "" {
		fmt.Println("Please set your GLOO_API_KEY environment variable")
		fmt.Println("You can create a .env file with:")
		fmt.Println("GLOO_API_KEY=your_api_key")
		return false
	}
	return true
}

// makeAuthenticatedRequest makes an authenticated API request using the API key
func makeAuthenticatedRequest(endpoint string, payload interface{}) (*ChatCompletionResponse, error) {
	var reqBody []byte
	var err error
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

	req.Header.Add("Authorization", "Bearer "+apiKey)
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

	// Test 1: Verify API key is configured
	fmt.Println("1. Verifying API key is configured...")
	if !validateCredentials() {
		return false
	}
	fmt.Println("   API key is set\n")

	// Test 2: API call with authentication
	fmt.Println("2. Testing authenticated API call...")
	request := ChatCompletionRequest{
		AutoRouting: true,
		Messages: []ChatMessage{
			{Role: "user", Content: "Hello! This is a test of the authentication system."},
		},
	}

	result, err := makeAuthenticatedRequest(apiURL, request)
	if err != nil {
		fmt.Printf("   API call failed: %v\n", err)
		return false
	}

	fmt.Println("   API call successful")
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
	apiKey = getEnv("GLOO_API_KEY", "")

	if !validateCredentials() {
		return
	}

	testAuthentication()
}
