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
	apiURL = "https://platform.ai.gloo.com/ai/v1/chat/completions"
)

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

// getEnv returns environment variable or default value
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// makeChatCompletionRequest makes a chat completion request
func makeChatCompletionRequest(message string) (*ChatCompletionResponse, error) {
	request := ChatCompletionRequest{
		Model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
		Messages: []ChatMessage{
			{Role: "user", Content: message},
		},
	}

	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(reqBody))
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

// testCompletionsAPI tests the completions API with multiple examples
func testCompletionsAPI() bool {
	fmt.Println("=== Gloo AI Completions API Test ===\n")

	testMessages := []string{
		"How can I be joyful in hard times?",
		"What are the benefits of a positive mindset?",
		"How do I build meaningful relationships?",
	}

	for i, message := range testMessages {
		fmt.Printf("Test %d: %s\n", i+1, message)

		completion, err := makeChatCompletionRequest(message)
		if err != nil {
			fmt.Printf("   ✗ Completion failed: %v\n", err)
			return false
		}

		fmt.Println("   ✓ Completion successful")
		content := completion.Choices[0].Message.Content
		if len(content) > 100 {
			content = content[:100] + "..."
		}
		fmt.Printf("   Response: %s\n\n", content)
	}

	fmt.Println("=== All completion tests passed! ===")
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

	testCompletionsAPI()
}
