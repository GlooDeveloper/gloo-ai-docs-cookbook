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

	"github.com/joho/godotenv"
)

// Configuration
var (
	glooAPIKey    string
	publisherName string
)

// API Endpoints
const (
	completionsURL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions"
	groundedURL    = "https://platform.ai.gloo.com/ai/v2/grounded/chat/completions"
)

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest represents a standard completion request
type CompletionRequest struct {
	Messages    []Message `json:"messages"`
	AutoRouting bool      `json:"auto_routing"`
	MaxTokens   int       `json:"max_tokens"`
}

// PublisherGroundedRequest represents a grounded completion request
type PublisherGroundedRequest struct {
	Messages     []Message `json:"messages"`
	AutoRouting  bool      `json:"auto_routing"`
	RagPublisher string    `json:"rag_publisher"`
	SourcesLimit int       `json:"sources_limit"`
	MaxTokens    int       `json:"max_tokens"`
}

// CompletionResponse represents the API response
type CompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
			Role    string `json:"role"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
		Index        int    `json:"index"`
	} `json:"choices"`
	SourcesReturned bool   `json:"sources_returned,omitempty"`
	Model           string `json:"model,omitempty"`
}

// makeNonGroundedRequest makes a standard V2 completion request WITHOUT grounding
func makeNonGroundedRequest(query string) (*CompletionResponse, error) {
	if glooAPIKey == "" {
		return nil, fmt.Errorf("missing API key: set GLOO_API_KEY environment variable")
	}

	payload := CompletionRequest{
		Messages: []Message{
			{Role: "user", Content: query},
		},
		AutoRouting: true,
		MaxTokens:   500,
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", completionsURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+glooAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result CompletionResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

// makePublisherGroundedRequest makes a grounded completion request WITH RAG
func makePublisherGroundedRequest(query, publisher string, sourcesLimit int) (*CompletionResponse, error) {
	if glooAPIKey == "" {
		return nil, fmt.Errorf("missing API key: set GLOO_API_KEY environment variable")
	}

	payload := PublisherGroundedRequest{
		Messages: []Message{
			{Role: "user", Content: query},
		},
		AutoRouting:  true,
		RagPublisher: publisher,
		SourcesLimit: sourcesLimit,
		MaxTokens:    500,
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", groundedURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+glooAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result CompletionResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

// compareResponses compares both approaches side-by-side
func compareResponses(query, publisher string) {
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Printf("Query: %s\n", query)
	fmt.Println(strings.Repeat("=", 80))

	// Step 1: Non-grounded
	fmt.Println("\n🔹 STEP 1: NON-GROUNDED Response (Generic Model Knowledge):")
	fmt.Println(strings.Repeat("-", 80))
	nonGrounded, err := makeNonGroundedRequest(query)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Println(nonGrounded.Choices[0].Message.Content)
		fmt.Println("\n📊 Metadata:")
		fmt.Printf("   Sources used: %v\n", nonGrounded.SourcesReturned)
		model := nonGrounded.Model
		if model == "" {
			model = "N/A"
		}
		fmt.Printf("   Model: %s\n", model)
	}

	fmt.Println("\n" + strings.Repeat("=", 80) + "\n")

	// Step 2: Publisher grounded
	fmt.Println("🔹 STEP 2: GROUNDED on Your Publisher (Your Specific Content):")
	fmt.Println(strings.Repeat("-", 80))
	publisherGrounded, err := makePublisherGroundedRequest(query, publisher, 3)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Println(publisherGrounded.Choices[0].Message.Content)
		fmt.Println("\n📊 Metadata:")
		fmt.Printf("   Sources used: %v\n", publisherGrounded.SourcesReturned)
		model := publisherGrounded.Model
		if model == "" {
			model = "N/A"
		}
		fmt.Printf("   Model: %s\n", model)
	}

	fmt.Println("\n" + strings.Repeat("=", 80) + "\n")
}

func promptToContinue() {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Press Enter to continue to next comparison...")
	reader.ReadString('\n')
}

func main() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Warning: .env file not found, using system environment variables")
	}

	glooAPIKey = os.Getenv("GLOO_API_KEY")
	publisherName = os.Getenv("PUBLISHER_NAME")
	if publisherName == "" {
		publisherName = "Bezalel"
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("\nPublisher: %s\n", publisherName)
	fmt.Println("This demo shows a 2-step progression:")
	fmt.Println("  1. Non-grounded (generic model knowledge)")
	fmt.Println("  2. Grounded on your publisher (your specific content)")
	fmt.Println("\nNote: For org-specific queries like Bezalel's hiring process,")
	fmt.Println("step 1 may lack specific details, while step 2")
	fmt.Println("provides accurate, source-backed answers from your content.\n")

	queries := []string{
		"What is Bezalel Ministries' hiring process?",
		"What educational resources does Bezalel Ministries provide?",
		"Describe Bezalel's research methodology for creating artwork.",
	}

	for i, query := range queries {
		fmt.Println("\n" + strings.Repeat("#", 80))
		fmt.Printf("# COMPARISON %d of %d\n", i+1, len(queries))
		fmt.Println(strings.Repeat("#", 80))

		compareResponses(query, publisherName)

		if i < len(queries)-1 {
			promptToContinue()
		}
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("  Demo Complete!")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("\nKey Takeaways:")
	fmt.Println("✓ Step 1 (Non-grounded): Generic model knowledge, may hallucinate")
	fmt.Println("✓ Step 2 (Publisher grounded): Your specific content, accurate and")
	fmt.Println("  source-backed (sources_returned: true)")
	fmt.Println("✓ Grounding on your publisher content ensures accurate, relevant answers")
	fmt.Println("  for organization-specific queries")
	fmt.Println("\nNext Steps:")
	fmt.Println("• Upload your own content to a Publisher in Gloo Studio")
	fmt.Println("• Update PUBLISHER_NAME in .env to use your content")
	fmt.Println("• Try both general and specific queries to see the differences!")
	fmt.Println()
}
