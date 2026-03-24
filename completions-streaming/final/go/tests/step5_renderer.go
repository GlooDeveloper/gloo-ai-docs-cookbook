//go:build ignore

// Typing-Effect Renderer Test
//
// Validates that RenderStreamToTerminal() streams tokens to stdout
// and prints a summary line with token count and finish_reason.
//
// Usage: go run tests/step5_renderer.go

package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/auth"
	"completions-streaming/pkg/browser"
)

func main() {
	fmt.Println("🧪 Testing: Typing-Effect Renderer")
	fmt.Println("")

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
	fmt.Println("✓ Token obtained")

	// Tee stdout: pipe to both original terminal (live) and a buffer (for validation)
	origStdout := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		fail(fmt.Sprintf("Failed to create pipe: %v", err))
	}
	os.Stdout = w

	var buf bytes.Buffer
	done := make(chan struct{})
	go func() {
		defer close(done)
		io.Copy(io.MultiWriter(origStdout, &buf), r)
	}()

	fmt.Println("\nTest 1: RenderStreamToTerminal — streaming to terminal...")
	renderErr := browser.RenderStreamToTerminal("Reply with exactly: Hello streaming world", token)

	w.Close()
	<-done
	os.Stdout = origStdout
	r.Close()

	if renderErr != nil {
		fail(fmt.Sprintf("RenderStreamToTerminal returned error: %v", renderErr))
	}

	output := buf.String()

	if !containsStr(output, "Prompt:") {
		fail("Output missing 'Prompt:' header")
	}
	fmt.Println("✓ Prompt header printed")

	if !containsStr(output, "Response:") {
		fail("Output missing 'Response:' label")
	}
	fmt.Println("✓ Response label printed")

	re := regexp.MustCompile(`\[(\d+) tokens, finish_reason=(\w+)\]`)
	matches := re.FindStringSubmatch(output)
	if matches == nil {
		fail("Output missing token summary '[N tokens, finish_reason=X]'")
	}

	tokenCount, _ := strconv.Atoi(matches[1])
	finishReason := matches[2]

	if tokenCount == 0 {
		fail("token count is 0 — no tokens were streamed")
	}

	fmt.Printf("✓ Token summary found: %d tokens, finish_reason=%s\n", tokenCount, finishReason)

	fmt.Println("\n✅ Typing-effect renderer working.")
	fmt.Println("   Next: Server-Side Proxy")
}

func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && findStr(s, substr)
}

func findStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func fail(msg string) {
	fmt.Println("\n❌ Typing-Effect Renderer Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - RenderStreamToTerminal should use fmt.Fprint(os.Stdout, content) for each token")
	fmt.Println("   - Print '[N tokens, finish_reason=X]' summary at end")
	fmt.Println("   - Check that the streaming loop correctly extracts token content")
	os.Exit(1)
}
