// Package streaming provides SSE streaming for the Gloo AI completions API.
package streaming

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const apiURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

// StreamResult holds the accumulated result of a streaming completion.
type StreamResult struct {
	Text         string `json:"text"`
	TokenCount   int    `json:"token_count"`
	DurationMs   int64  `json:"duration_ms"`
	FinishReason string `json:"finish_reason"`
}

// SSEChunk represents the JSON structure of one SSE data line.
type SSEChunk struct {
	ID      string `json:"id"`
	Choices []struct {
		Delta struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
		Index        int     `json:"index"`
	} `json:"choices"`
}

// HandleStreamError checks the HTTP status code and returns a descriptive
// error for 401, 403, 429, and other non-200 statuses. Returns nil on 200.
func HandleStreamError(statusCode int, responseBody string) error {
	// TODO: Check statusCode and return specific errors (Step 6):
	// 1. Check if status code is 401 and return an authentication error
	// 2. Check if status code is 403 and return an authorization error
	// 3. Check if status code is 429 and return a rate limit error
	// 4. Check if status code is not 200, return a generic API error that includes the response body
	// 5. Return nil for status code 200 — that is a successful response
	return fmt.Errorf("not implemented - see TODO comments")
}

// MakeStreamingRequest posts to the completions API with stream:true.
//
// Returns the raw *http.Response with an open body. The caller is
// responsible for closing the body.
func MakeStreamingRequest(message, token string) (*http.Response, error) {
	// TODO: Make a streaming POST request to the completions API (Step 2):
	// 1. Build Authorization and Content-Type headers using the provided token
	// 2. Build the request payload with the user message, auto_routing flag, and stream set to true
	// 3. Create and send a POST request to the API URL
	// 4. Call HandleStreamError to fail fast before reading the response body
	// 5. Return the raw *http.Response for the caller to iterate
	return nil, fmt.Errorf("not implemented - see TODO comments")
}

// ParseSSELine parses one line from the SSE stream.
//
// SSE lines follow the format `data: <json-payload>`. The stream ends when a chunk
// arrives with a non-null choices[0].FinishReason (e.g. "stop"). A "[DONE]" sentinel
// is handled for compatibility but is not sent by the Gloo AI API.
//
// Returns:
//   - nil for blank or non-data lines
//   - the string "[DONE]" if a [DONE] sentinel is encountered (not sent by Gloo AI)
//   - a *SSEChunk for valid data lines
func ParseSSELine(line string) any {
	// TODO: Parse one SSE text line (Step 3):
	// 1. Check if line is empty or whitespace only, return nil
	// 2. Check if line starts with "data: ", return nil if not
	// 3. Extract the data payload by stripping the "data: " prefix
	// 4. Check if the stripped data equals "[DONE]" and return it
	// 5. Try to unmarshal the data into an SSEChunk and return it
	// 6. Catch unmarshal errors and return nil
	return nil
}

// ExtractTokenContent safely extracts the text content from a parsed chunk.
//
// Returns an empty string for chunks with no content (role-only or finish
// reason-only deltas).
func ExtractTokenContent(chunk *SSEChunk) string {
	// TODO: Extract delta content from a parsed SSE chunk (Step 4):
	// 1. Return empty string if chunk is nil or the Choices slice is empty
	// 2. Access the Delta field of the first choice
	// 3. Return the Content value, or empty string if the pointer is nil
	return ""
}

// StreamCompletion runs the accumulation loop: streams a completion and
// collects the full result.
//
// Calls MakeStreamingRequest, iterates SSE lines, parses each with
// ParseSSELine, extracts content with ExtractTokenContent, and builds
// the full response text.
func StreamCompletion(message, token string) (*StreamResult, error) {
	// TODO: Implement the accumulation loop (Step 5):
	// 1. Record the start time and open the stream by calling MakeStreamingRequest
	// 2. Defer closing the response body and initialize accumulators for text, token count, and finish reason
	// 3. Use a bufio.Scanner to read the response body line by line
	// 4. Parse each line with ParseSSELine, skipping non-content lines and stopping at the termination signal
	// 5. Extract content from each chunk, append to the text buffer, and update token count and finish reason
	// 6. Check for scanner errors after the loop and return a populated StreamResult
	return nil, fmt.Errorf("not implemented - see TODO comments")
}
