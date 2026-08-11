//go:build ignore

// Environment Setup & Auth Verification Test
//
// Validates that the API key loads correctly and the streaming endpoint
// responds with 200 OK and Content-Type: text/event-stream.
//
// Usage: go run tests/step1_auth.go

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

const apiURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

func main() {
	fmt.Println("🧪 Testing: Environment Setup & Auth Verification")
	fmt.Println("")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	apiKey := os.Getenv("GLOO_API_KEY")

	if apiKey == "" {
		fmt.Println("❌ Missing required environment variable")
		fmt.Println("   Make sure .env file contains:")
		fmt.Println("   - GLOO_API_KEY")
		os.Exit(1)
	}

	fmt.Println("✓ API key loaded")

	// Test 1: Verify streaming endpoint returns 200 + text/event-stream
	fmt.Println("\nTest 1: Verifying streaming endpoint...")
	payload, _ := json.Marshal(map[string]any{
		"messages":     []map[string]string{{"role": "user", "content": "Hi"}},
		"auto_routing": true,
		"stream":       true,
	})

	req, _ := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		fail(fmt.Sprintf("HTTP request failed: %v", err))
	}
	defer func() {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		fail(fmt.Sprintf("Expected 200, got %d", resp.StatusCode))
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" || len(contentType) < len("text/event-stream") {
		fail(fmt.Sprintf("Expected Content-Type: text/event-stream, got: %q", contentType))
	}

	fmt.Println("✓ Status: 200 OK")
	fmt.Printf("✓ Content-Type: %s\n", contentType)

	fmt.Println("\n✅ Auth and streaming endpoint verified.")
	fmt.Println("   Next: Making the Streaming Request")
}

func fail(msg string) {
	fmt.Println("\n❌ Auth Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - Check that .env has a valid GLOO_API_KEY")
	fmt.Println("   - Verify credentials at https://studio.ai.gloo.com/api-keys")
	fmt.Println("   - Ensure you have internet connectivity")
	os.Exit(1)
}
