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

// V2CompletionResponse represents the API response
type V2CompletionResponse struct {
	Model            string `json:"model"`
	RoutingMechanism string `json:"routing_mechanism"`
	Choices          []struct {
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

// makeRequest makes an API request
func makeRequest(payload map[string]interface{}) (*V2CompletionResponse, error) {
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
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

	var response V2CompletionResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// makeV2AutoRouting - Example 1: Auto-routing
func makeV2AutoRouting(message, tradition string) (*V2CompletionResponse, error) {
	payload := map[string]interface{}{
		"messages":     []map[string]string{{"role": "user", "content": message}},
		"auto_routing": true,
		"tradition":    tradition,
	}
	return makeRequest(payload)
}

// makeV2ModelFamily - Example 2: Model family selection
func makeV2ModelFamily(message, modelFamily string) (*V2CompletionResponse, error) {
	payload := map[string]interface{}{
		"messages":     []map[string]string{{"role": "user", "content": message}},
		"model_family": modelFamily,
	}
	return makeRequest(payload)
}

// makeV2DirectModel - Example 3: Direct model selection
func makeV2DirectModel(message, model string) (*V2CompletionResponse, error) {
	payload := map[string]interface{}{
		"messages":    []map[string]string{{"role": "user", "content": message}},
		"model":       model,
		"temperature": 0.7,
		"max_tokens":  500,
	}
	return makeRequest(payload)
}

// truncate truncates a string to a maximum length
func truncate(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}

// testCompletionsV2API tests the Completions V2 API with all three routing strategies
func testCompletionsV2API() bool {
	fmt.Println("=== Gloo AI Completions V2 API Test ===\n")

	// Example 1: Auto-routing
	fmt.Println("Example 1: Auto-Routing")
	fmt.Println("Testing: How does the Old Testament connect to the New Testament?")
	result1, err := makeV2AutoRouting("How does the Old Testament connect to the New Testament?", "evangelical")
	if err != nil {
		fmt.Printf("   ✗ Auto-routing failed: %v\n", err)
		return false
	}
	fmt.Printf("   Model used: %s\n", result1.Model)
	fmt.Printf("   Routing: %s\n", result1.RoutingMechanism)
	fmt.Printf("   Response: %s\n", truncate(result1.Choices[0].Message.Content, 100))
	fmt.Println("   ✓ Auto-routing test passed\n")

	// Example 2: Model family selection
	fmt.Println("Example 2: Model Family Selection")
	fmt.Println("Testing: Draft a short sermon outline on forgiveness.")
	result2, err := makeV2ModelFamily("Draft a short sermon outline on forgiveness.", "anthropic")
	if err != nil {
		fmt.Printf("   ✗ Model family failed: %v\n", err)
		return false
	}
	fmt.Printf("   Model used: %s\n", result2.Model)
	fmt.Printf("   Response: %s\n", truncate(result2.Choices[0].Message.Content, 100))
	fmt.Println("   ✓ Model family test passed\n")

	// Example 3: Direct model selection
	fmt.Println("Example 3: Direct Model Selection")
	fmt.Println("Testing: Summarize the book of Romans in 3 sentences.")
	result3, err := makeV2DirectModel("Summarize the book of Romans in 3 sentences.", "gloo-anthropic-claude-sonnet-4.5")
	if err != nil {
		fmt.Printf("   ✗ Direct model failed: %v\n", err)
		return false
	}
	fmt.Printf("   Model used: %s\n", result3.Model)
	fmt.Printf("   Response: %s\n", truncate(result3.Choices[0].Message.Content, 100))
	fmt.Println("   ✓ Direct model test passed\n")

	fmt.Println("=== All Completions V2 tests passed! ===")
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
	apiKey = getEnv("GLOO_API_KEY", "YOUR_API_KEY")

	if apiKey == "YOUR_API_KEY" {
		fmt.Println("Please set your GLOO_API_KEY environment variable")
		fmt.Println("You can create a .env file with:")
		fmt.Println("GLOO_API_KEY=your_api_key")
		return
	}

	testCompletionsV2API()
}
