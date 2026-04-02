// Streaming AI Responses in Real Time - Go Entry Point
//
// Demonstrates SSE-based streaming from the Gloo AI completions API.
// Shows token accumulation and typing-effect rendering.
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/auth"
	"completions-streaming/pkg/browser"
	"completions-streaming/pkg/streaming"
)

func main() {
	// Load .env file if present
	if err := godotenv.Load(); err != nil {
		// Ignore missing .env; env vars may be set in the shell
	}

	fmt.Println("Streaming AI Responses in Real Time\n")

	clientID := os.Getenv("GLOO_CLIENT_ID")
	clientSecret := os.Getenv("GLOO_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		fmt.Fprintln(os.Stderr, "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET")
		os.Exit(1)
	}

	fmt.Println("Environment variables loaded\n")

	// --- Example 1: Accumulate full response ---
	fmt.Println("Example: Streaming a completion (accumulate full text)...")
	token, err := auth.EnsureValidToken()
	if err != nil {
		log.Fatalf("Failed to get token: %v", err)
	}

	result, err := streaming.StreamCompletion(
		"What is the significance of the resurrection?",
		token,
	)
	if err != nil {
		log.Fatalf("Stream completion failed: %v", err)
	}

	fmt.Printf("\nFull response:\n%s\n", result.Text)
	fmt.Printf("\nReceived %d tokens in %dms\n", result.TokenCount, result.DurationMs)
	fmt.Printf("  Finish reason: %s\n", result.FinishReason)

	// --- Example 2: Typing-effect rendering ---
	fmt.Println("\nExample: Typing-effect rendering...")
	if err := browser.RenderStreamToTerminal("Tell me about Christian discipleship.", token); err != nil {
		log.Fatalf("Render stream failed: %v", err)
	}
}
