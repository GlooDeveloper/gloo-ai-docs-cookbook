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
	fmt.Printf("Prompt: %s\n\nResponse: ", message)

	resp, err := streaming.MakeStreamingRequest(message, token)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	totalTokens := 0
	finishReason := "unknown"

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		parsed := streaming.ParseSSELine(line)
		if parsed == nil {
			continue
		}
		if s, ok := parsed.(string); ok && s == "[DONE]" {
			break
		}
		chunk, ok := parsed.(*streaming.SSEChunk)
		if !ok {
			continue
		}

		content := streaming.ExtractTokenContent(chunk)
		if content != "" {
			fmt.Fprint(os.Stdout, content)
			totalTokens++
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].FinishReason != nil {
			finishReason = *chunk.Choices[0].FinishReason
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading stream: %w", err)
	}

	fmt.Printf("\n\n[%d tokens, finish_reason=%s]\n", totalTokens, finishReason)
	return nil
}
