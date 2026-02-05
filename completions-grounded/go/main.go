package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Configuration
var (
	glooClientID     string
	glooClientSecret string
	publisherName    string
)

// API Endpoints
const (
	tokenURL       = "https://platform.ai.gloo.com/oauth2/token"
	completionsURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"
	groundedURL    = "https://platform.ai.gloo.com/ai/v2/chat/completions/grounded"
)

// Token management
var (
	accessToken string
	tokenExpiry time.Time
)

// TokenResponse represents the OAuth2 token response
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

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

// DefaultGroundedRequest represents a grounded request without publisher
type DefaultGroundedRequest struct {
	Messages     []Message `json:"messages"`
	AutoRouting  bool      `json:"auto_routing"`
	SourcesLimit int       `json:"sources_limit"`
	MaxTokens    int       `json:"max_tokens"`
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

// getAccessToken retrieves an OAuth2 access token from Gloo AI
func getAccessToken() (*TokenResponse, error) {
	if glooClientID == "" || glooClientSecret == "" {
		return nil, fmt.Errorf("missing credentials: set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables")
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", glooClientID)
	data.Set("client_secret", glooClientSecret)

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request failed with status %d", resp.StatusCode)
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// ensureValidToken ensures we have a valid access token, refreshing if necessary
func ensureValidToken() (string, error) {
	if accessToken == "" || time.Now().After(tokenExpiry) {
		tokenData, err := getAccessToken()
		if err != nil {
			return "", err
		}

		accessToken = tokenData.AccessToken
		expiresIn := tokenData.ExpiresIn
		if expiresIn == 0 {
			expiresIn = 3600
		}
		tokenExpiry = time.Now().Add(time.Duration(expiresIn-300) * time.Second)
	}

	return accessToken, nil
}

// makeNonGroundedRequest makes a standard V2 completion request WITHOUT grounding
func makeNonGroundedRequest(query string) (*CompletionResponse, error) {
	token, err := ensureValidToken()
	if err != nil {
		return nil, err
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
	req.Header.Set("Authorization", "Bearer "+token)
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

// makeDefaultGroundedRequest makes a grounded request on Gloo's default dataset
func makeDefaultGroundedRequest(query string, sourcesLimit int) (*CompletionResponse, error) {
	token, err := ensureValidToken()
	if err != nil {
		return nil, err
	}

	payload := DefaultGroundedRequest{
		Messages: []Message{
			{Role: "user", Content: query},
		},
		AutoRouting:  true,
		SourcesLimit: sourcesLimit,
		MaxTokens:    500,
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", groundedURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
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
	token, err := ensureValidToken()
	if err != nil {
		return nil, err
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
	req.Header.Set("Authorization", "Bearer "+token)
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

// compareResponses compares all 3 approaches side-by-side
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

	// Step 2: Default grounded
	fmt.Println("🔹 STEP 2: GROUNDED on Default Dataset (Gloo's Faith-Based Content):")
	fmt.Println(strings.Repeat("-", 80))
	defaultGrounded, err := makeDefaultGroundedRequest(query, 3)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Println(defaultGrounded.Choices[0].Message.Content)
		fmt.Println("\n📊 Metadata:")
		fmt.Printf("   Sources used: %v\n", defaultGrounded.SourcesReturned)
		model := defaultGrounded.Model
		if model == "" {
			model = "N/A"
		}
		fmt.Printf("   Model: %s\n", model)
	}

	fmt.Println("\n" + strings.Repeat("=", 80) + "\n")

	// Step 3: Publisher grounded
	fmt.Println("🔹 STEP 3: GROUNDED on Your Publisher (Your Specific Content):")
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

	glooClientID = os.Getenv("GLOO_CLIENT_ID")
	glooClientSecret = os.Getenv("GLOO_CLIENT_SECRET")
	publisherName = os.Getenv("PUBLISHER_NAME")
	if publisherName == "" {
		publisherName = "Bezalel"
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("\nPublisher: %s\n", publisherName)
	fmt.Println("This demo shows a 3-step progression:")
	fmt.Println("  1. Non-grounded (generic model knowledge)")
	fmt.Println("  2. Grounded on default dataset (Gloo's faith-based content)")
	fmt.Println("  3. Grounded on your publisher (your specific content)")
	fmt.Println("\nNote: For org-specific queries like Bezalel's hiring process,")
	fmt.Println("both steps 1 and 2 may lack specific details, while step 3")
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
	fmt.Println("✓ Step 2 (Default grounded): Uses Gloo's faith-based content, better for")
	fmt.Println("  general questions but lacks org-specific details")
	fmt.Println("✓ Step 3 (Publisher grounded): Your specific content, accurate and")
	fmt.Println("  source-backed (sources_returned: true)")
	fmt.Println("✓ Grounding on relevant content is key - generic grounding may not help")
	fmt.Println("  for organization-specific queries")
	fmt.Println("\nNext Steps:")
	fmt.Println("• Upload your own content to a Publisher in Gloo Studio")
	fmt.Println("• Update PUBLISHER_NAME in .env to use your content")
	fmt.Println("• Try both general and specific queries to see the differences!")
	fmt.Println()
}
