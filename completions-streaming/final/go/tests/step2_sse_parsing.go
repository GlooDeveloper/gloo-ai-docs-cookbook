// Steps 2–3 Test: Streaming Request & SSE Line Parsing
//
// Validates that:
// - MakeStreamingRequest() opens a streaming connection
// - ParseSSELine() correctly parses data lines, blank lines, and [DONE]
//
// Usage: go run tests/step2_sse_parsing.go

package main

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/auth"
	"completions-streaming/pkg/streaming"
)

func main() {
	fmt.Println("🧪 Testing Steps 2–3: Streaming Request & SSE Line Parsing\n")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	if os.Getenv("GLOO_CLIENT_ID") == "" {
		fmt.Println("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
		os.Exit(1)
	}

	token, err := auth.EnsureValidToken()
	if err != nil {
		fail(fmt.Sprintf("EnsureValidToken failed: %v", err))
	}
	fmt.Println("✓ Token obtained\n")

	// Test 1: ParseSSELine — blank line
	fmt.Println("Test 1: ParseSSELine — blank line...")
	result := streaming.ParseSSELine("")
	if result != nil {
		fail(fmt.Sprintf("Expected nil for blank line, got: %v", result))
	}
	fmt.Println("✓ Blank line → nil")

	// Test 2: ParseSSELine — non-data line
	fmt.Println("Test 2: ParseSSELine — non-data line...")
	result = streaming.ParseSSELine("event: message")
	if result != nil {
		fail(fmt.Sprintf("Expected nil for non-data line, got: %v", result))
	}
	fmt.Println("✓ Non-data line → nil")

	// Test 3: ParseSSELine — [DONE] sentinel
	fmt.Println("Test 3: ParseSSELine — [DONE] sentinel...")
	result = streaming.ParseSSELine("data: [DONE]")
	done, ok := result.(string)
	if !ok || done != "[DONE]" {
		fail(fmt.Sprintf("Expected '[DONE]', got: %v", result))
	}
	fmt.Println("✓ data: [DONE] → \"[DONE]\"")

	// Test 4: ParseSSELine — valid JSON data line
	fmt.Println("Test 4: ParseSSELine — valid JSON data line...")
	sample := `data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}`
	result = streaming.ParseSSELine(sample)
	chunk, ok := result.(*streaming.SSEChunk)
	if !ok || chunk == nil {
		fail(fmt.Sprintf("Expected *SSEChunk, got: %T", result))
	}
	if len(chunk.Choices) == 0 || chunk.Choices[0].Delta.Content != "Hello" {
		fail("Unexpected content value in parsed chunk")
	}
	fmt.Println("✓ data: {json} → *SSEChunk")

	// Test 5: ParseSSELine — malformed JSON
	fmt.Println("Test 5: ParseSSELine — malformed JSON...")
	result = streaming.ParseSSELine("data: {broken json")
	if result != nil {
		fail(fmt.Sprintf("Expected nil for malformed JSON, got: %v", result))
	}
	fmt.Println("✓ Malformed JSON → nil (gracefully handled)\n")

	// Test 6: Live streaming connection
	fmt.Println("Test 6: MakeStreamingRequest() — live connection...")
	resp, err := streaming.MakeStreamingRequest("Say exactly: 'Stream test OK'", token)
	if err != nil {
		fail(fmt.Sprintf("MakeStreamingRequest failed: %v", err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fail(fmt.Sprintf("Expected 200, got %d", resp.StatusCode))
	}
	fmt.Println("✓ Streaming connection opened (status 200)")

	// Test 7: Iterate lines and detect [DONE]
	fmt.Println("Test 7: Iterating SSE lines and detecting [DONE]...")
	scanner := bufio.NewScanner(resp.Body)
	linesProcessed, dataChunks := 0, 0
	doneDetected := false

	for scanner.Scan() {
		line := scanner.Text()
		linesProcessed++
		parsed := streaming.ParseSSELine(line)
		if s, ok := parsed.(string); ok && s == "[DONE]" {
			doneDetected = true
			break
		}
		if _, ok := parsed.(*streaming.SSEChunk); ok {
			dataChunks++
		}
	}
	io.Copy(io.Discard, resp.Body)

	fmt.Printf("✓ Processed %d lines, %d data chunks\n", linesProcessed, dataChunks)

	if !doneDetected {
		fmt.Println("⚠️  [DONE] not detected — stream may have ended without sentinel")
	} else {
		fmt.Println("✓ [DONE] sentinel detected — stream terminated cleanly")
	}

	fmt.Println("\n✅ Steps 2–3 Complete! Streaming request and SSE parsing working.")
	fmt.Println("   Continue to Step 4: Extracting Token Content\n")
}

func fail(msg string) {
	fmt.Println("\n❌ Steps 2–3 Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - Check MakeStreamingRequest() sets stream:true in the payload")
	fmt.Println("   - Check ParseSSELine() strips 'data: ' prefix (line[6:])")
	fmt.Println("   - Verify [DONE] check: strings.TrimSpace(data) == \"[DONE]\"\n")
	os.Exit(1)
}
