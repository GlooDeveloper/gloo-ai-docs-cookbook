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
	// 1. statusCode == 401: return fmt.Errorf("authentication failed (401): invalid or expired token")
	// 2. statusCode == 403: return fmt.Errorf("authorization failed (403): insufficient permissions")
	// 3. statusCode == 429: return fmt.Errorf("rate limit exceeded (429): too many requests")
	// 4. statusCode != 200: return fmt.Errorf("API error (%d): %s", statusCode, responseBody[:min(len(responseBody), 200)])
	// Return nil for statusCode == 200 — that is a successful response.
	return fmt.Errorf("not implemented - see TODO comments")
}

// MakeStreamingRequest posts to the completions API with stream:true.
//
// Returns the raw *http.Response with an open body. The caller is
// responsible for closing the body.
func MakeStreamingRequest(message, token string) (*http.Response, error) {
	// TODO: Make a streaming POST request to the completions API (Step 2):
	// 1. Build JSON payload: messages, auto_routing: true, stream: true
	// 2. Create http.NewRequest("POST", APIURL, bytes.NewReader(payloadBytes))
	// 3. Set headers: Authorization: Bearer <token>, Content-Type: application/json
	// 4. Execute with http.DefaultClient.Do(req)
	// 5. Call HandleStreamError(resp.StatusCode, ...) to fail fast on non-200
	// 6. Return the *http.Response (body not yet read)
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
	// 1. Return nil if line is blank or does not start with "data: "
	// 2. Strip the "data: " prefix: data := line[6:]
	// 3. Return "[DONE]" if strings.TrimSpace(data) == "[DONE]"
	// 4. Try json.Unmarshal into an SSEChunk; return nil on error
	return nil
}

// ExtractTokenContent safely extracts the text content from a parsed chunk.
//
// Returns an empty string for chunks with no content (role-only or finish
// reason-only deltas).
func ExtractTokenContent(chunk *SSEChunk) string {
	// TODO: Extract delta content from a parsed SSE chunk (Step 4):
	// 1. Return "" if chunk is nil or chunk.Choices is empty
	// 2. Access chunk.Choices[0].Delta.Content
	// 3. Return the content string (empty string if nil pointer)
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
	// 1. Record start := time.Now()
	// 2. Call MakeStreamingRequest(message, token) to open the stream
	// 3. Defer resp.Body.Close()
	// 4. Initialize fullText strings.Builder, tokenCount int, finishReason = "unknown"
	// 5. Use bufio.NewScanner(resp.Body) to read line by line:
	//    a. chunk := ParseSSELine(scanner.Text()) — skip nil, break on "[DONE]"
	//    b. ExtractTokenContent — append to fullText, increment tokenCount
	//    c. Capture chunk.Choices[0].FinishReason when non-empty
	// 6. Check scanner.Err() for mid-stream errors
	// 7. Return &StreamResult{Text, TokenCount, DurationMs, FinishReason}, nil
	return nil, fmt.Errorf("not implemented - see TODO comments")
}
