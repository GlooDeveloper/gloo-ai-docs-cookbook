package main

import (
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

// Configuration constants
const (
	tokenURL    = "https://platform.ai.gloo.com/oauth2/token"
	messageURL  = "https://platform.ai.gloo.com/ai/v1/message"
	chatURL     = "https://platform.ai.gloo.com/ai/v1/chat"
	httpTimeout = 30 * time.Second
)

// Data structures
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

type MessageRequest struct {
	Query             string   `json:"query"`
	CharacterLimit    int      `json:"character_limit,omitempty"`
	SourcesLimit      int      `json:"sources_limit,omitempty"`
	Stream            bool     `json:"stream,omitempty"`
	Publishers        []string `json:"publishers,omitempty"`
	ChatID            string   `json:"chat_id,omitempty"`
	EnableSuggestions int      `json:"enable_suggestions,omitempty"`
}

type MessageResponse struct {
	ChatID      string   `json:"chat_id"`
	QueryID     string   `json:"query_id"`
	MessageID   string   `json:"message_id"`
	Message     string   `json:"message"`
	Timestamp   string   `json:"timestamp"`
	Success     bool     `json:"success"`
	Suggestions []string `json:"suggestions"`
	Sources     []any    `json:"sources"`
}

type ChatMessage struct {
	QueryID        string `json:"query_id"`
	MessageID      string `json:"message_id"`
	Timestamp      string `json:"timestamp"`
	Role           string `json:"role"`
	Message        string `json:"message"`
	CharacterLimit *int   `json:"character_limit,omitempty"`
}

type ChatHistory struct {
	ChatID    string        `json:"chat_id"`
	CreatedAt string        `json:"created_at"`
	Messages  []ChatMessage `json:"messages"`
}

type ApiError struct {
	Detail string `json:"detail"`
	Code   string `json:"code,omitempty"`
}

// Global variables
var (
	clientID     string
	clientSecret string
	httpClient   *http.Client
	tokenInfo    *TokenInfo
)

// Custom error type
type GlooApiError struct {
	Message    string
	StatusCode int
}

func (e *GlooApiError) Error() string {
	return e.Message
}

func init() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		// .env file is optional, so don't fail if it doesn't exist
		fmt.Println("Warning: .env file not found, using environment variables")
	}
	
	// Initialize configuration
	clientID = getEnvOrDefault("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
	clientSecret = getEnvOrDefault("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
	
	// Initialize HTTP client with timeout
	httpClient = &http.Client{
		Timeout: httpTimeout,
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getAccessToken() (*TokenInfo, error) {
	data := strings.NewReader("grant_type=client_credentials&scope=api/access")
	req, err := http.NewRequest("POST", tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("authentication request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr ApiError
		if err := json.Unmarshal(body, &apiErr); err == nil && apiErr.Detail != "" {
			return nil, &GlooApiError{
				Message:    fmt.Sprintf("authentication failed: %s", apiErr.Detail),
				StatusCode: resp.StatusCode,
			}
		}
		return nil, &GlooApiError{
			Message:    fmt.Sprintf("authentication failed: HTTP %d - %s", resp.StatusCode, string(body)),
			StatusCode: resp.StatusCode,
		}
	}

	var token TokenInfo
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	token.ExpiresAt = time.Now().Unix() + int64(token.ExpiresIn)
	return &token, nil
}

func isTokenExpired(token *TokenInfo) bool {
	if token == nil || token.ExpiresAt == 0 {
		return true
	}
	return time.Now().Unix() > (token.ExpiresAt - 60)
}

func ensureValidToken() (string, error) {
	if isTokenExpired(tokenInfo) {
		fmt.Println("Getting new access token...")
		var err error
		tokenInfo, err = getAccessToken()
		if err != nil {
			return "", err
		}
	}
	return tokenInfo.AccessToken, nil
}

func sendMessage(messageText string, chatID string) (*MessageResponse, error) {
	token, err := ensureValidToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get valid token: %w", err)
	}

	payload := MessageRequest{
		Query:             messageText,
		CharacterLimit:    1000,
		SourcesLimit:      5,
		Stream:            false,
		Publishers:        []string{},
		EnableSuggestions: 1, // Enable suggested follow-up questions
	}

	if chatID != "" {
		payload.ChatID = chatID
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", messageURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("message request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr ApiError
		if err := json.Unmarshal(body, &apiErr); err == nil && apiErr.Detail != "" {
			return nil, &GlooApiError{
				Message:    fmt.Sprintf("message sending failed: %s", apiErr.Detail),
				StatusCode: resp.StatusCode,
			}
		}
		return nil, &GlooApiError{
			Message:    fmt.Sprintf("message sending failed: HTTP %d - %s", resp.StatusCode, string(body)),
			StatusCode: resp.StatusCode,
		}
	}

	var response MessageResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

func getChatHistory(chatID string) (*ChatHistory, error) {
	token, err := ensureValidToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get valid token: %w", err)
	}

	params := url.Values{}
	params.Add("chat_id", chatID)
	requestURL := fmt.Sprintf("%s?%s", chatURL, params.Encode())

	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("chat history request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr ApiError
		if err := json.Unmarshal(body, &apiErr); err == nil && apiErr.Detail != "" {
			return nil, &GlooApiError{
				Message:    fmt.Sprintf("chat history retrieval failed: %s", apiErr.Detail),
				StatusCode: resp.StatusCode,
			}
		}
		return nil, &GlooApiError{
			Message:    fmt.Sprintf("chat history retrieval failed: HTTP %d - %s", resp.StatusCode, string(body)),
			StatusCode: resp.StatusCode,
		}
	}

	var history ChatHistory
	if err := json.Unmarshal(body, &history); err != nil {
		return nil, fmt.Errorf("failed to parse chat history: %w", err)
	}

	return &history, nil
}

func formatTimestamp(timestamp string) string {
	if t, err := time.Parse(time.RFC3339, timestamp); err == nil {
		return t.Format("2006-01-02 15:04:05")
	}
	return timestamp
}

func validateEnvironment() error {
	if clientID == "YOUR_CLIENT_ID" || clientSecret == "YOUR_CLIENT_SECRET" {
		return fmt.Errorf("please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables")
	}
	return nil
}

func displayMessage(message ChatMessage, index int) {
	role := strings.ToUpper(message.Role)
	timestamp := formatTimestamp(message.Timestamp)
	fmt.Printf("%d. %s [%s]:\n", index+1, role, timestamp)
	fmt.Printf("%s\n\n", message.Message)
}

func main() {
	// Validate environment
	if err := validateEnvironment(); err != nil {
		fmt.Printf("❌ Environment Error: %v\n", err)
		fmt.Println("Create a .env file with:")
		fmt.Println("GLOO_CLIENT_ID=your_client_id")
		fmt.Println("GLOO_CLIENT_SECRET=your_client_secret")
		os.Exit(1)
	}

	// Start with a deep, meaningful question about human flourishing
	initialQuestion := "How can I find meaning and purpose when facing life's greatest challenges?"

	fmt.Println("=== Starting New Chat Session ===")
	fmt.Printf("Question: %s\n\n", initialQuestion)

	// Create new chat session
	chatResponse, err := sendMessage(initialQuestion, "")
	if err != nil {
		fmt.Printf("❌ Error creating chat: %v\n", err)
		os.Exit(1)
	}

	chatID := chatResponse.ChatID

	fmt.Println("AI Response:")
	fmt.Printf("%s\n\n", chatResponse.Message)

	// Show suggested follow-up questions
	if len(chatResponse.Suggestions) > 0 {
		fmt.Println("\nSuggested follow-up questions:")
		for i, suggestion := range chatResponse.Suggestions {
			fmt.Printf("%d. %s\n", i+1, suggestion)
		}
		fmt.Println()
	}

	// Use the first suggested question for follow-up, or fallback
	var followUpQuestion string
	if len(chatResponse.Suggestions) > 0 {
		followUpQuestion = chatResponse.Suggestions[0]
	} else {
		followUpQuestion = "Can you give me practical steps I can take today to begin this journey?"
	}

	fmt.Println("=== Continuing the Conversation ===")
	fmt.Printf("Using suggested question: %s\n\n", followUpQuestion)
	
	// Send follow-up message
	followUpResponse, err := sendMessage(followUpQuestion, chatID)
	if err != nil {
		fmt.Printf("❌ Error sending follow-up: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("AI Response:")
	fmt.Println(followUpResponse.Message)
	fmt.Println()

	// Display final chat history
	fmt.Println("=== Complete Chat History ===")
	chatHistory, err := getChatHistory(chatID)
	if err != nil {
		fmt.Printf("❌ Error getting chat history: %v\n", err)
		os.Exit(1)
	}

	for i, message := range chatHistory.Messages {
		displayMessage(message, i)
	}

	fmt.Println("✅ Chat session completed successfully!")
	fmt.Printf("📊 Total messages: %d\n", len(chatHistory.Messages))
	fmt.Printf("🔗 Chat ID: %s\n", chatID)
	fmt.Printf("📅 Session created: %s\n", formatTimestamp(chatHistory.CreatedAt))
}