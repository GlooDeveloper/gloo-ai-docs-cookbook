// Streaming Error Handling Test
//
// Validates that:
// - HandleStreamError() returns the right error for 401, 403, 429
// - HandleStreamError() returns nil for 200
// - Bad credentials produce a proper auth error
//
// Usage: go run tests/step4_error_handling.go

package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/streaming"
)

func main() {
	fmt.Println("🧪 Testing: Streaming Error Handling\n")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	if os.Getenv("GLOO_CLIENT_ID") == "" {
		fmt.Println("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
		os.Exit(1)
	}

	// Test 1: HandleStreamError(401)
	fmt.Println("Test 1: HandleStreamError(401)...")
	err := streaming.HandleStreamError(401, "")
	if err == nil {
		fail("Expected error for 401, but got nil")
	}
	if !strings.Contains(err.Error(), "401") {
		fail(fmt.Sprintf("Expected 401 in message, got: %s", err.Error()))
	}
	fmt.Printf("✓ 401 returns error: %s\n", err.Error())

	// Test 2: HandleStreamError(403)
	fmt.Println("Test 2: HandleStreamError(403)...")
	err = streaming.HandleStreamError(403, "")
	if err == nil {
		fail("Expected error for 403, but got nil")
	}
	if !strings.Contains(err.Error(), "403") {
		fail(fmt.Sprintf("Expected 403 in message, got: %s", err.Error()))
	}
	fmt.Printf("✓ 403 returns error: %s\n", err.Error())

	// Test 3: HandleStreamError(429)
	fmt.Println("Test 3: HandleStreamError(429)...")
	err = streaming.HandleStreamError(429, "")
	if err == nil {
		fail("Expected error for 429, but got nil")
	}
	if !strings.Contains(err.Error(), "429") {
		fail(fmt.Sprintf("Expected 429 in message, got: %s", err.Error()))
	}
	fmt.Printf("✓ 429 returns error: %s\n", err.Error())

	// Test 4: HandleStreamError(200) — should return nil
	fmt.Println("Test 4: HandleStreamError(200) — should return nil...")
	err = streaming.HandleStreamError(200, "")
	if err != nil {
		fail(fmt.Sprintf("HandleStreamError(200) should return nil, but returned: %s", err.Error()))
	}
	fmt.Println("✓ 200 returns nil")

	// Test 5: HandleStreamError(500) with body
	fmt.Println("Test 5: HandleStreamError(500)...")
	err = streaming.HandleStreamError(500, "Internal Server Error")
	if err == nil {
		fail("Expected error for 500, but got nil")
	}
	if !strings.Contains(err.Error(), "500") {
		fail(fmt.Sprintf("Expected 500 in message, got: %s", err.Error()))
	}
	fmt.Printf("✓ 500 returns error with body: %s\n", err.Error())

	// Test 6: Bad credentials are caught by MakeStreamingRequest
	fmt.Println("\nTest 6: Bad credentials → auth error...")
	_, err = streaming.MakeStreamingRequest("test", "invalid-token-xyz")
	if err == nil {
		fail("Expected MakeStreamingRequest to fail with bad credentials")
	}
	fmt.Printf("✓ Bad credentials caught: %s\n", err.Error())

	fmt.Println("\n✅ Two-phase error handling working.")
	fmt.Println("   Next: Browser-Based Streaming\n")
}

func fail(msg string) {
	fmt.Println("\n❌ Streaming Error Handling Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - HandleStreamError should return error for any non-200 status")
	fmt.Println("   - Specific messages for 401, 403, 429 help users debug auth issues")
	fmt.Println("   - MakeStreamingRequest calls HandleStreamError after checking StatusCode\n")
	os.Exit(1)
}
