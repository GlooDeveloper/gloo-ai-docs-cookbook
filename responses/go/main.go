package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/joho/godotenv"
)

// Configuration
const apiURL = "https://platform.ai.gloo.com/ai/v2/guarded/responses"

var apiKey string

// envValue returns an environment variable value, ignoring unset placeholders
// (empty values or TODO comments, mirroring the Python _env helper).
func envValue(name, fallback string) string {
	value := os.Getenv(name)
	stripped := strings.TrimSpace(value)
	if stripped == "" || strings.HasPrefix(stripped, "#") {
		return fallback
	}
	return value
}

// headers returns the common request headers.
func headers() http.Header {
	h := http.Header{}
	h.Set("Authorization", "Bearer "+apiKey)
	h.Set("Content-Type", "application/json")
	return h
}

// post sends a request, returning a clear error (including the response body) on failure.
func post(payload map[string]interface{}) (map[string]interface{}, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header = headers()

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		hint := ""
		if resp.StatusCode == http.StatusForbidden {
			hint = " (guardrails hard-blocked this request)"
		}
		return nil, fmt.Errorf("API request failed with status %d%s: %s", resp.StatusCode, hint, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return result, nil
}

// extractText extracts assistant text from a Responses API payload's output[] array.
func extractText(result map[string]interface{}) string {
	var parts []string
	output, _ := result["output"].([]interface{})
	for _, item := range output {
		itemMap, ok := item.(map[string]interface{})
		if !ok || itemMap["type"] != "message" {
			continue
		}
		content, _ := itemMap["content"].([]interface{})
		for _, part := range content {
			partMap, ok := part.(map[string]interface{})
			if !ok || partMap["type"] != "output_text" {
				continue
			}
			text, _ := partMap["text"].(string)
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n")
}

// makeBasicResponse - Example 1: Basic guarded response with a theological tradition.
func makeBasicResponse(message, tradition string) (map[string]interface{}, error) {
	return post(map[string]interface{}{
		"model":             envValue("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6"),
		"input":             message,
		"tradition":         tradition,
		"max_output_tokens": 256,
	})
}

// makeInstructionsResponse - Example 2: Instructions plus multi-turn input array
// (alternating user/assistant roles).
func makeInstructionsResponse(instructions string, inputItems []map[string]interface{}) (map[string]interface{}, error) {
	return post(map[string]interface{}{
		"model":             envValue("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6"),
		"instructions":      instructions,
		"input":             inputItems,
		"max_output_tokens": 256,
	})
}

// streamResponse - Example 3: Streaming via SSE; returns accumulated text and usage.
//
// Note: each data: payload is the flattened event object itself (its "type"
// matches the event: line); there is no nested "response" key, and the
// response.completed payload carries usage but not the output[] array.
func streamResponse(message string) (string, map[string]interface{}, error) {
	payload := map[string]interface{}{
		"model":             envValue("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6"),
		"input":             message,
		"stream":            true,
		"max_output_tokens": 256,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return "", nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header = headers()
	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		hint := ""
		if resp.StatusCode == http.StatusForbidden {
			hint = " (guardrails hard-blocked this request)"
		}
		return "", nil, fmt.Errorf("API request failed with status %d%s: %s", resp.StatusCode, hint, string(respBody))
	}

	var textParts, doneParts []string
	var usage map[string]interface{}
	event := ""

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "event:"):
			event = strings.TrimSpace(line[len("event:"):])
			continue
		case !strings.HasPrefix(line, "data:"):
			continue
		}

		var data map[string]interface{}
		if err := json.Unmarshal([]byte(strings.TrimSpace(line[len("data:"):])), &data); err != nil {
			return "", nil, fmt.Errorf("stream terminated by malformed SSE data: %s", line)
		}

		switch {
		case event == "response.output_text.delta":
			delta, _ := data["delta"].(string)
			fmt.Print(delta)
			textParts = append(textParts, delta)
		case event == "response.output_text.done":
			text, _ := data["text"].(string)
			doneParts = append(doneParts, text)
		case event == "response.completed":
			// Docs nest the final response under "response"; the live API
			// flattens it into the payload itself. Accept both shapes.
			final, ok := data["response"].(map[string]interface{})
			if !ok {
				final = data
			}
			if u, ok := final["usage"].(map[string]interface{}); ok {
				usage = u
			}
			if len(textParts) == 0 && len(doneParts) == 0 {
				doneParts = append(doneParts, extractText(final))
			}
		case strings.HasPrefix(event, "response."):
			// Other lifecycle events (response.created, response.in_progress,
			// response.output_item.*, response.content_part.*, ...).
		case strings.HasPrefix(event, "error"):
			// Error events are terminal.
			dataJSON, _ := json.Marshal(data)
			return "", nil, fmt.Errorf("stream error event '%s': %s", event, string(dataJSON))
		default:
			// Unknown event: treat as terminal and close the stream.
			dataJSON, _ := json.Marshal(data)
			return "", nil, fmt.Errorf("stream terminated by unknown event '%s': %s", event, string(dataJSON))
		}
		event = ""
	}
	if err := scanner.Err(); err != nil {
		return "", nil, fmt.Errorf("failed to read SSE stream: %w", err)
	}

	fmt.Println()
	text := strings.Join(textParts, "")
	if text == "" {
		text = strings.Join(doneParts, "")
	}
	return text, usage, nil
}

// makeVisionResponse - Example 4: Vision — image input via typed content parts.
func makeVisionResponse(imageURL, question string) (map[string]interface{}, error) {
	return post(map[string]interface{}{
		"model": envValue("GLOO_VISION_MODEL", "gloo-google-gemini-3.1-pro"),
		"input": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "input_text", "text": question},
					{"type": "input_image", "image_url": imageURL},
				},
			},
		},
		"max_output_tokens": 256,
	})
}

// truncate truncates a string to a maximum length.
func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) > maxLen {
		return string(runes[:maxLen])
	}
	return s
}

// testResponsesAPI runs all four examples against the live API.
func testResponsesAPI() bool {
	fmt.Printf("=== Gloo AI Guarded Responses API Test ===\n\n")

	// Example 1: Basic guarded response with tradition
	fmt.Println("Example 1: Basic Guarded Response (tradition=evangelical)")
	fmt.Println("Testing: How can our small group support a grieving member?")
	result1, err := makeBasicResponse("How can our small group support a grieving member?", "evangelical")
	if err != nil {
		fmt.Printf("   ✗ Test failed: %v\n", err)
		return false
	}
	model, _ := result1["model"].(string)
	fmt.Printf("   Model used: %s\n", model)
	text1 := extractText(result1)
	fmt.Printf("   Response: %s...\n", truncate(text1, 100))
	usage1, _ := json.Marshal(result1["usage"])
	fmt.Printf("   Usage: %s\n", string(usage1))
	fmt.Printf("   ✓ Example %d passed\n\n", 1)

	// Example 2: Instructions + multi-turn input
	fmt.Println("Example 2: Instructions + Multi-turn Input")
	fmt.Println("Testing: three-turn conversation (user → assistant → user) with pastoral-care instructions")
	result2, err := makeInstructionsResponse(
		"You are a compassionate pastoral assistant. Keep answers brief and warm.",
		[]map[string]interface{}{
			{
				"role":    "user",
				"content": "I've been asked to lead a grief support group at church. Where do I start?",
			},
			{
				"role":    "assistant",
				"content": "That's a meaningful calling. Start with prayerful preparation — ask God to prepare your own heart before you prepare the room.",
			},
			{
				"role":    "user",
				"content": "What should I do in the very first meeting?",
			},
		},
	)
	if err != nil {
		fmt.Printf("   ✗ Test failed: %v\n", err)
		return false
	}
	model2, _ := result2["model"].(string)
	fmt.Printf("   Model used: %s\n", model2)
	text2 := extractText(result2)
	fmt.Printf("   Response: %s...\n", truncate(text2, 100))
	usage2, _ := json.Marshal(result2["usage"])
	fmt.Printf("   Usage: %s\n", string(usage2))
	fmt.Printf("   ✓ Example %d passed\n\n", 2)

	// Example 3: Streaming
	fmt.Println("Example 3: Streaming (SSE)")
	fmt.Println("Testing: Write a one-paragraph prayer for a new season of ministry.")
	text3, usage3, err := streamResponse("Write a one-paragraph prayer for a new season of ministry.")
	if err != nil {
		fmt.Printf("   ✗ Test failed: %v\n", err)
		return false
	}
	fmt.Printf("   Model used: %s\n", envValue("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6"))
	fmt.Printf("   Streamed text (%d chars): %s...\n", utf8.RuneCountInString(text3), truncate(text3, 100))
	usage3JSON, _ := json.Marshal(usage3)
	fmt.Printf("   Usage: %s\n", string(usage3JSON))
	if text3 == "" {
		fmt.Println("   ✗ Test failed: streaming produced no text")
		return false
	}
	if usage3 == nil {
		fmt.Println("   ✗ Test failed: streaming produced no usage")
		return false
	}
	fmt.Printf("   ✓ Example %d passed\n\n", 3)

	// Example 4: Vision
	fmt.Println("Example 4: Vision (Image Input)")
	fmt.Printf("Testing: %s\n", envValue("VISION_IMAGE_URL", "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg"))
	result4, err := makeVisionResponse(
		envValue("VISION_IMAGE_URL", "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg"),
		"What animal is in this image?",
	)
	if err != nil {
		fmt.Printf("   ✗ Test failed: %v\n", err)
		return false
	}
	model4, _ := result4["model"].(string)
	fmt.Printf("   Model used: %s\n", model4)
	text4 := extractText(result4)
	fmt.Printf("   Response: %s...\n", truncate(text4, 100))
	usage4, _ := json.Marshal(result4["usage"])
	fmt.Printf("   Usage: %s\n", string(usage4))
	fmt.Printf("   ✓ Example %d passed\n\n", 4)

	fmt.Println("=== All Responses API tests passed! ===")
	return true
}

// main is the entry point.
func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found, using environment variables")
	}

	apiKey = os.Getenv("GLOO_API_KEY")
	if strings.TrimSpace(apiKey) == "" || strings.HasPrefix(strings.TrimSpace(apiKey), "#") {
		apiKey = "YOUR_API_KEY"
	}

	if apiKey == "YOUR_API_KEY" {
		fmt.Println("Please set your GLOO_API_KEY environment variable")
		fmt.Println("You can create a .env file with:")
		fmt.Println("GLOO_API_KEY=your_api_key")
		return
	}

	if !testResponsesAPI() {
		os.Exit(1)
	}
}
