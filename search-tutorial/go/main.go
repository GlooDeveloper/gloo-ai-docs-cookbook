// Gloo AI Search API - Go Example
//
// This program demonstrates how to use the Gloo AI Search API
// to perform semantic search on your ingested content, with
// support for filtering, pagination, and RAG.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// --- Configuration ---
var (
	clientID     string
	clientSecret string
	tenant       string

	tokenURL       = "https://platform.ai.gloo.com/oauth2/token"
	searchURL      = "https://platform.ai.gloo.com/ai/data/v1/search"
	completionsURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"
)

// --- Types ---

// SearchRequest is the request payload for the Search API.
type SearchRequest struct {
	Query      string  `json:"query"`
	Collection string  `json:"collection"`
	Tenant     string  `json:"tenant"`
	Limit      int     `json:"limit"`
	Certainty  float64 `json:"certainty"`
}

// SearchMetadata holds result relevance data.
type SearchMetadata struct {
	Distance  float64 `json:"distance"`
	Certainty float64 `json:"certainty"`
	Score     float64 `json:"score"`
}

// SearchProperties holds result content data.
type SearchProperties struct {
	ItemTitle string   `json:"item_title"`
	Type      string   `json:"type"`
	Author    []string `json:"author"`
	Snippet   string   `json:"snippet"`
}

// SearchResult is a single search result.
type SearchResult struct {
	UUID       string           `json:"uuid"`
	Metadata   SearchMetadata   `json:"metadata"`
	Properties SearchProperties `json:"properties"`
	Collection string           `json:"collection"`
}

// SearchResponse is the response from the Search API.
type SearchResponse struct {
	Data   []SearchResult `json:"data"`
	Intent int            `json:"intent"`
}

// CompletionMessage is a chat message for completions.
type CompletionMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest is the request payload for Completions V2.
type CompletionRequest struct {
	Messages    []CompletionMessage `json:"messages"`
	AutoRouting bool                `json:"auto_routing"`
	MaxTokens   int                 `json:"max_tokens"`
}

// CompletionChoice is a single completion choice.
type CompletionChoice struct {
	Message CompletionMessage `json:"message"`
}

// CompletionResponse is the response from Completions V2.
type CompletionResponse struct {
	Choices []CompletionChoice `json:"choices"`
}

// Snippet holds extracted snippet data for RAG.
type Snippet struct {
	Text      string
	Title     string
	Type      string
	Relevance float64
}

// --- Search Client ---

// SearchClient handles search requests.
type SearchClient struct {
	TokenManager *TokenManager
}

// Search performs a semantic search query.
func (sc *SearchClient) Search(query string, limit int) (*SearchResponse, error) {
	token, err := sc.TokenManager.EnsureValidToken()
	if err != nil {
		return nil, err
	}

	payload := SearchRequest{
		Query:      query,
		Collection: "GlooProd",
		Tenant:     tenant,
		Limit:      limit,
		Certainty:  0.5,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search request: %w", err)
	}

	req, err := http.NewRequest("POST", searchURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	return &result, nil
}

// FilterByContentType filters results by content type.
func (sc *SearchClient) FilterByContentType(results *SearchResponse, contentTypes []string) *SearchResponse {
	if results == nil || len(results.Data) == 0 {
		return results
	}

	typeSet := make(map[string]bool)
	for _, t := range contentTypes {
		typeSet[t] = true
	}

	var filtered []SearchResult
	for _, r := range results.Data {
		if typeSet[r.Properties.Type] {
			filtered = append(filtered, r)
		}
	}

	return &SearchResponse{Data: filtered, Intent: results.Intent}
}

// SortByCertainty sorts results by certainty score descending.
func (sc *SearchClient) SortByCertainty(results *SearchResponse) {
	if results == nil || len(results.Data) == 0 {
		return
	}
	sort.Slice(results.Data, func(i, j int) bool {
		return results.Data[i].Metadata.Certainty > results.Data[j].Metadata.Certainty
	})
}

// --- RAG Helper ---

// RAGHelper provides RAG workflow utilities.
type RAGHelper struct {
	TokenManager *TokenManager
}

// ExtractSnippets extracts and formats snippets from search results.
func (rh *RAGHelper) ExtractSnippets(results *SearchResponse, maxSnippets, maxCharsPerSnippet int) []Snippet {
	if results == nil || len(results.Data) == 0 {
		return nil
	}

	var snippets []Snippet
	for i, r := range results.Data {
		if i >= maxSnippets {
			break
		}
		text := r.Properties.Snippet
		if len(text) > maxCharsPerSnippet {
			text = text[:maxCharsPerSnippet]
		}
		snippets = append(snippets, Snippet{
			Text:      text,
			Title:     r.Properties.ItemTitle,
			Type:      r.Properties.Type,
			Relevance: r.Metadata.Certainty,
		})
	}

	return snippets
}

// FormatContextForLLM formats snippets as context for LLM.
func (rh *RAGHelper) FormatContextForLLM(snippets []Snippet) string {
	var parts []string
	for i, s := range snippets {
		parts = append(parts, fmt.Sprintf("[Source %d: %s (%s)]\n%s\n", i+1, s.Title, s.Type, s.Text))
	}
	return strings.Join(parts, "\n---\n")
}

// GenerateWithContext calls Completions V2 API with custom context.
func (rh *RAGHelper) GenerateWithContext(query, context, systemPrompt string) (string, error) {
	token, err := rh.TokenManager.EnsureValidToken()
	if err != nil {
		return "", err
	}

	if systemPrompt == "" {
		systemPrompt = "You are a helpful assistant. Answer the user's question based on the " +
			"provided context. If the context doesn't contain relevant information, " +
			"say so honestly."
	}

	payload := CompletionRequest{
		Messages: []CompletionMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Context:\n%s\n\nQuestion: %s", context, query)},
		},
		AutoRouting: true,
		MaxTokens:   1000,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal completions request: %w", err)
	}

	req, err := http.NewRequest("POST", completionsURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create completions request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("completions request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("completions API failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result CompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode completions response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", nil
	}

	return result.Choices[0].Message.Content, nil
}

// --- Commands ---

func basicSearch(query string, limit int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	sc := &SearchClient{TokenManager: tm}

	fmt.Printf("Searching for: '%s'\n", query)
	fmt.Printf("Limit: %d results\n\n", limit)

	results, err := sc.Search(query, limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Search failed: %v\n", err)
		os.Exit(1)
	}

	if len(results.Data) == 0 {
		fmt.Println("No results found.")
		return
	}

	fmt.Printf("Found %d results:\n\n", len(results.Data))

	for i, r := range results.Data {
		fmt.Printf("--- Result %d ---\n", i+1)
		fmt.Printf("Title: %s\n", r.Properties.ItemTitle)
		fmt.Printf("Type: %s\n", r.Properties.Type)
		fmt.Printf("Author: %s\n", strings.Join(r.Properties.Author, ", "))
		fmt.Printf("Relevance Score: %.4f\n", r.Metadata.Certainty)

		snippet := r.Properties.Snippet
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		if snippet != "" {
			fmt.Printf("Snippet: %s...\n", snippet)
		}
		fmt.Println()
	}
}

func filteredSearch(query string, contentTypes []string, limit int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	sc := &SearchClient{TokenManager: tm}

	fmt.Printf("Searching for: '%s'\n", query)
	fmt.Printf("Content types: %s\n", strings.Join(contentTypes, ", "))
	fmt.Printf("Limit: %d\n\n", limit)

	results, err := sc.Search(query, limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Search failed: %v\n", err)
		os.Exit(1)
	}

	filtered := sc.FilterByContentType(results, contentTypes)

	if len(filtered.Data) == 0 {
		fmt.Println("No results found matching filters.")
		return
	}

	fmt.Printf("Found %d results:\n\n", len(filtered.Data))

	for i, r := range filtered.Data {
		fmt.Printf("%d. %s (%s)\n", i+1, r.Properties.ItemTitle, r.Properties.Type)
	}
}

func ragSearch(query string, limit int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	sc := &SearchClient{TokenManager: tm}
	rh := &RAGHelper{TokenManager: tm}

	fmt.Printf("RAG Search for: '%s'\n\n", query)

	fmt.Println("Step 1: Searching for relevant content...")
	results, err := sc.Search(query, limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Search failed: %v\n", err)
		os.Exit(1)
	}

	if len(results.Data) == 0 {
		fmt.Println("No results found.")
		return
	}

	fmt.Printf("Found %d results\n\n", len(results.Data))

	fmt.Println("Step 2: Extracting snippets...")
	snippets := rh.ExtractSnippets(results, limit, 500)
	context := rh.FormatContextForLLM(snippets)
	fmt.Printf("Extracted %d snippets\n\n", len(snippets))

	fmt.Println("Step 3: Generating response with context...\n")
	response, err := rh.GenerateWithContext(query, context, "")
	if err != nil {
		fmt.Fprintf(os.Stderr, "RAG generation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== Generated Response ===")
	fmt.Println(response)
	fmt.Println("\n=== Sources Used ===")
	for _, s := range snippets {
		fmt.Printf("- %s (%s)\n", s.Title, s.Type)
	}
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run . search <query> [limit]")
	fmt.Println("  go run . filter <query> <types> [limit]")
	fmt.Println("  go run . rag <query> [limit]")
	fmt.Println("  go run . server [port]")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  go run . search \"How can I know my purpose?\" 5")
	fmt.Println("  go run . filter \"purpose\" \"Article,Video\" 10")
	fmt.Println("  go run . rag \"How can I know my purpose?\" 3")
	fmt.Println("  go run . server 3000")
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	// Load .env file
	godotenv.Load()

	clientID = getEnv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
	tenant = getEnv("GLOO_TENANT", "your-tenant-name")

	ValidateCredentials(clientID, clientSecret)

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := strings.ToLower(os.Args[1])

	// Server command doesn't need a query argument
	if command == "server" {
		port := "3000"
		if len(os.Args) > 2 {
			port = os.Args[2]
		}
		startServer(port)
		return
	}

	if len(os.Args) < 3 {
		printUsage()
		os.Exit(1)
	}

	query := os.Args[2]

	switch command {
	case "search":
		limit := 10
		if len(os.Args) > 3 {
			limit, _ = strconv.Atoi(os.Args[3])
		}
		basicSearch(query, limit)

	case "filter":
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Error: Content types required for filter command")
			printUsage()
			os.Exit(1)
		}
		types := strings.Split(os.Args[3], ",")
		limit := 10
		if len(os.Args) > 4 {
			limit, _ = strconv.Atoi(os.Args[4])
		}
		filteredSearch(query, types, limit)

	case "rag":
		limit := 5
		if len(os.Args) > 3 {
			limit, _ = strconv.Atoi(os.Args[3])
		}
		ragSearch(query, limit)

	default:
		fmt.Fprintf(os.Stderr, "Error: Unknown command '%s'\n", command)
		printUsage()
		os.Exit(1)
	}
}
