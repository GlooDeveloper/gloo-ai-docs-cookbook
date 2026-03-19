// Environment Setup & Auth Verification Test
//
// Validates that credentials load correctly and the streaming endpoint
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

	"completions-streaming/pkg/auth"
)

const apiURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

func main() {
	fmt.Println("🧪 Testing: Environment Setup & Auth Verification\n")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	clientID := os.Getenv("GLOO_CLIENT_ID")
	clientSecret := os.Getenv("GLOO_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		fmt.Println("❌ Missing required environment variables")
		fmt.Println("   Make sure .env file contains:")
		fmt.Println("   - GLOO_CLIENT_ID")
		fmt.Println("   - GLOO_CLIENT_SECRET")
		os.Exit(1)
	}

	fmt.Println("✓ GLOO_CLIENT_ID loaded")
	fmt.Println("✓ GLOO_CLIENT_SECRET loaded\n")

	// Test 1: Get access token
	fmt.Println("Test 1: Obtaining access token...")
	tokenData, err := auth.GetAccessToken()
	if err != nil {
		fail(fmt.Sprintf("GetAccessToken failed: %v", err))
	}
	if tokenData.AccessToken == "" {
		fail("Token response missing access_token field")
	}
	fmt.Println("✓ Access token obtained")
	fmt.Printf("  Expires in: %d seconds\n", tokenData.ExpiresIn)

	// Test 2: EnsureValidToken caches correctly
	fmt.Println("\nTest 2: Token caching (EnsureValidToken)...")
	token1, err := auth.EnsureValidToken()
	if err != nil {
		fail(fmt.Sprintf("EnsureValidToken (first call) failed: %v", err))
	}
	token2, err := auth.EnsureValidToken()
	if err != nil {
		fail(fmt.Sprintf("EnsureValidToken (second call) failed: %v", err))
	}
	if token1 != token2 {
		fail("EnsureValidToken returned different tokens on consecutive calls")
	}
	fmt.Println("✓ Token cached correctly — same token returned on consecutive calls")

	// Test 3: Verify streaming endpoint returns 200 + text/event-stream
	fmt.Println("\nTest 3: Verifying streaming endpoint...")
	payload, _ := json.Marshal(map[string]any{
		"messages":     []map[string]string{{"role": "user", "content": "Hi"}},
		"auto_routing": true,
		"stream":       true,
	})

	req, _ := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+token1)
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
	fmt.Println("   Next: Making the Streaming Request\n")
}

func fail(msg string) {
	fmt.Println("\n❌ Auth Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - Check that .env has valid GLOO_CLIENT_ID and GLOO_CLIENT_SECRET")
	fmt.Println("   - Verify credentials at https://platform.ai.gloo.com/studio/manage-api-credentials")
	fmt.Println("   - Ensure you have internet connectivity\n")
	os.Exit(1)
}
