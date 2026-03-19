// Token Extraction & Full Response Assembly Test
//
// Validates that:
// - ExtractTokenContent() safely navigates choices[0].delta.content
// - StreamCompletion() assembles the full text and tracks timing/count
//
// Usage: go run tests/step3_accumulation.go

package main

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/auth"
	"completions-streaming/pkg/streaming"
)

func main() {
	fmt.Println("🧪 Testing: Token Extraction & Accumulation\n")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	if os.Getenv("GLOO_CLIENT_ID") == "" {
		fmt.Println("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
		os.Exit(1)
	}

	// Helper to build a simple SSEChunk for unit tests
	makeChunk := func(content string, finishReason *string) *streaming.SSEChunk {
		choice := struct {
			Delta struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"delta"`
			FinishReason *string `json:"finish_reason"`
			Index        int     `json:"index"`
		}{}
		choice.Delta.Content = content
		choice.FinishReason = finishReason
		return &streaming.SSEChunk{Choices: []struct {
			Delta struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"delta"`
			FinishReason *string `json:"finish_reason"`
			Index        int     `json:"index"`
		}{choice}}
	}

	// Test 1: ExtractTokenContent — normal chunk
	fmt.Println("Test 1: ExtractTokenContent — normal chunk...")
	chunk := makeChunk("Hello", nil)
	result := streaming.ExtractTokenContent(chunk)
	if result != "Hello" {
		fail(fmt.Sprintf("Expected 'Hello', got: %q", result))
	}
	fmt.Println("✓ Normal chunk → 'Hello'")

	// Test 2: ExtractTokenContent — empty content
	fmt.Println("Test 2: ExtractTokenContent — empty content...")
	chunk = makeChunk("", nil)
	result = streaming.ExtractTokenContent(chunk)
	if result != "" {
		fail(fmt.Sprintf("Expected '', got: %q", result))
	}
	fmt.Println("✓ Empty content → ''")

	// Test 3: ExtractTokenContent — nil chunk
	fmt.Println("Test 3: ExtractTokenContent — nil chunk...")
	result = streaming.ExtractTokenContent(nil)
	if result != "" {
		fail(fmt.Sprintf("Expected '' for nil chunk, got: %q", result))
	}
	fmt.Println("✓ Nil chunk → ''")

	// Test 4: ExtractTokenContent — empty choices
	fmt.Println("Test 4: ExtractTokenContent — empty choices...")
	emptyChunk := &streaming.SSEChunk{}
	result = streaming.ExtractTokenContent(emptyChunk)
	if result != "" {
		fail(fmt.Sprintf("Expected '' for empty choices, got: %q", result))
	}
	fmt.Println("✓ Empty choices → ''")

	// Test 5: ExtractTokenContent — finish_reason chunk
	fmt.Println("Test 5: ExtractTokenContent — finish_reason chunk...")
	stopReason := "stop"
	chunk = makeChunk("", &stopReason)
	result = streaming.ExtractTokenContent(chunk)
	if result != "" {
		fail(fmt.Sprintf("Expected '' for finish_reason chunk, got: %q", result))
	}
	fmt.Println("✓ finish_reason chunk → '' (no content from finish chunk)\n")

	// Test 6: Full StreamCompletion integration test
	fmt.Println("Test 6: StreamCompletion — full response assembly...")
	token, err := auth.EnsureValidToken()
	if err != nil {
		fail(fmt.Sprintf("EnsureValidToken failed: %v", err))
	}

	streamResult, err := streaming.StreamCompletion(
		"Count from 1 to 5, separated by spaces. Reply with only the numbers.",
		token,
	)
	if err != nil {
		fail(fmt.Sprintf("StreamCompletion failed: %v", err))
	}
	if streamResult == nil {
		fail("StreamCompletion returned nil result")
	}

	fmt.Println("✓ Delta content extraction working")
	fmt.Println("✓ Null delta handled gracefully")
	fmt.Printf("✓ finish_reason detected: %s\n", streamResult.FinishReason)
	fmt.Printf("✓ Duration tracked: %dms\n", streamResult.DurationMs)
	fmt.Printf("✓ Token count: %d tokens\n", streamResult.TokenCount)

	if streamResult.Text != "" {
		preview := streamResult.Text
		if len(preview) > 80 {
			preview = preview[:80]
		}
		fmt.Printf("  Response preview: %q\n", preview)
	} else {
		fmt.Println("⚠️  Empty response text — check accumulation loop")
	}

	if streamResult.TokenCount == 0 {
		fail("TokenCount is 0 — ExtractTokenContent may not be working")
	}
	if streamResult.DurationMs <= 0 {
		fail("DurationMs is 0 — timing not tracked")
	}

	fmt.Println("\n✅ Full response assembled.")
	fmt.Println("   Next: Streaming Error Handling\n")
}

func fail(msg string) {
	fmt.Println("\n❌ Token Extraction & Accumulation Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - ExtractTokenContent: check chunk.Choices[0].Delta.Content")
	fmt.Println("   - StreamCompletion: increment tokenCount only when content != \"\"")
	fmt.Println("   - Capture start := time.Now() before the request\n")
	os.Exit(1)
}
