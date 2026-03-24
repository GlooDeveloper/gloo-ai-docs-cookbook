// Package browser provides a CLI typing-effect renderer for streaming completions.
package browser

import (
	"bufio"
	"fmt"
	"os"

	"completions-streaming/pkg/streaming"
)

// RenderStreamToTerminal streams a completion and prints tokens to stdout
// without newlines, creating a typing effect in the terminal.
//
// Each token is written immediately via os.Stdout so the user sees text
// appear token-by-token without waiting for the full response.
func RenderStreamToTerminal(message, token string) error {
	// TODO: Implement the typing-effect terminal renderer (Step 7):
	// 1. Print the prompt: fmt.Printf("Prompt: %s\n\nResponse: ", message)
	// 2. Call MakeStreamingRequest(message, token) to open the stream
	// 3. Defer resp.Body.Close()
	// 4. Initialize totalTokens int, finishReason = "unknown"
	// 5. Use bufio.NewScanner(resp.Body) to read line by line:
	//    a. ParseSSELine — skip nil, break on "[DONE]"
	//    b. ExtractTokenContent — print immediately: fmt.Print(content)
	//    c. Track totalTokens and finishReason
	// 6. Print final summary: fmt.Printf("\n\n[%d tokens, finish_reason=%s]\n", totalTokens, finishReason)
	// 7. Return scanner.Err()
	return fmt.Errorf("not implemented - see TODO comments")
}
