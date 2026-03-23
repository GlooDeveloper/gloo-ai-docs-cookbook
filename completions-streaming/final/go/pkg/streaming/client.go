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
	switch statusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized:
		return fmt.Errorf("authentication failed (401): invalid or expired token")
	case http.StatusForbidden:
		return fmt.Errorf("authorization failed (403): insufficient permissions")
	case http.StatusTooManyRequests:
		return fmt.Errorf("rate limit exceeded (429): too many requests")
	default:
		preview := responseBody
		if len(preview) > 200 {
			preview = preview[:200]
		}
		return fmt.Errorf("API error (%d): %s", statusCode, preview)
	}
}

// MakeStreamingRequest posts to the completions API with stream:true.
//
// Returns the raw *http.Response with an open body. The caller is
// responsible for closing the body.
func MakeStreamingRequest(message, token string) (*http.Response, error) {
	payload := map[string]any{
		"messages":     []map[string]string{{"role": "user", "content": message}},
		"auto_routing": true,
		"stream":       true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("streaming request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, HandleStreamError(resp.StatusCode, string(bodyBytes))
	}

	return resp, nil
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
	if strings.TrimSpace(line) == "" {
		return nil
	}
	if !strings.HasPrefix(line, "data: ") {
		return nil
	}
	data := line[6:] // strip "data: "
	if strings.TrimSpace(data) == "[DONE]" {
		return "[DONE]"
	}
	var chunk SSEChunk
	if err := json.Unmarshal([]byte(data), &chunk); err != nil {
		return nil
	}
	return &chunk
}

// ExtractTokenContent safely extracts the text content from a parsed chunk.
//
// Returns an empty string for chunks with no content (role-only or finish
// reason-only deltas).
func ExtractTokenContent(chunk *SSEChunk) string {
	if chunk == nil || len(chunk.Choices) == 0 {
		return ""
	}
	return chunk.Choices[0].Delta.Content
}

// StreamCompletion runs the accumulation loop: streams a completion and
// collects the full result.
//
// Calls MakeStreamingRequest, iterates SSE lines, parses each with
// ParseSSELine, extracts content with ExtractTokenContent, and builds
// the full response text.
func StreamCompletion(message, token string) (*StreamResult, error) {
	start := time.Now()

	resp, err := MakeStreamingRequest(message, token)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var (
		fullText     strings.Builder
		tokenCount   int
		finishReason = "unknown"
	)

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		parsed := ParseSSELine(line)
		if parsed == nil {
			continue
		}
		if s, ok := parsed.(string); ok && s == "[DONE]" {
			break
		}
		chunk, ok := parsed.(*SSEChunk)
		if !ok {
			continue
		}

		content := ExtractTokenContent(chunk)
		if content != "" {
			fullText.WriteString(content)
			tokenCount++
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].FinishReason != nil {
			finishReason = *chunk.Choices[0].FinishReason
		}
	}

	if err := scanner.Err(); err != nil && fullText.Len() == 0 {
		return nil, fmt.Errorf("error reading stream: %w", err)
	}

	durationMs := time.Since(start).Milliseconds()
	return &StreamResult{
		Text:         fullText.String(),
		TokenCount:   tokenCount,
		DurationMs:   durationMs,
		FinishReason: finishReason,
	}, nil
}
