package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// --- Config ---

var (
	clientID     string
	clientSecret string
	tenant       string
	collection   string
	tokenURL     string

	recommendationsBaseURL    string
	recommendationsVerboseURL string
	affiliatesURL             string

	defaultItemCount int
)

// --- Request / Response Types ---

// RecommendationsRequest is the request body for publisher-scoped endpoints.
type RecommendationsRequest struct {
	Query               string  `json:"query"`
	ItemCount           int     `json:"item_count"`
	CertaintyThreshold  float64 `json:"certainty_threshold"`
	Collection          string  `json:"collection"`
	Tenant              string  `json:"tenant"`
}

// AffiliatesRequest is the request body for the affiliate network endpoint.
type AffiliatesRequest struct {
	Query              string  `json:"query"`
	ItemCount          int     `json:"item_count"`
	CertaintyThreshold float64 `json:"certainty_threshold"`
}

// SnippetUUIDBase holds snippet metadata for base recommendations.
type SnippetUUIDBase struct {
	UUID        string  `json:"uuid"`
	AITitle     string  `json:"ai_title"`
	AISubtitle  string  `json:"ai_subtitle"`
	ItemSummary string  `json:"item_summary"`
	Certainty   float64 `json:"certainty"`
}

// RecommendationItemBase is a single item from the base recommendations endpoint.
type RecommendationItemBase struct {
	ItemID       string            `json:"item_id"`
	ItemTitle    string            `json:"item_title"`
	Author       []string          `json:"author"`
	ItemURL      string            `json:"item_url"`
	UUIDs        []SnippetUUIDBase `json:"uuids"`
}

// SnippetUUIDVerbose extends SnippetUUIDBase with the full snippet text.
type SnippetUUIDVerbose struct {
	UUID        string  `json:"uuid"`
	AITitle     string  `json:"ai_title"`
	AISubtitle  string  `json:"ai_subtitle"`
	ItemSummary string  `json:"item_summary"`
	Certainty   float64 `json:"certainty"`
	Snippet     string  `json:"snippet"`
}

// RecommendationItemVerbose is a single item from the verbose recommendations endpoint.
type RecommendationItemVerbose struct {
	ItemID    string               `json:"item_id"`
	ItemTitle string               `json:"item_title"`
	Author    []string             `json:"author"`
	ItemURL   string               `json:"item_url"`
	UUIDs     []SnippetUUIDVerbose `json:"uuids"`
}

// AffiliateItem is a single item from the affiliate network endpoint.
type AffiliateItem struct {
	ItemTitle    string   `json:"item_title"`
	ItemSubtitle string   `json:"item_subtitle"`
	Author       []string `json:"author"`
	Tradition    string   `json:"tradition"`
	ItemURL      string   `json:"item_url"`
}

// --- API Clients ---

// RecommendationsClient fetches publisher-scoped recommendations (metadata only).
type RecommendationsClient struct {
	tokenManager *TokenManager
	baseURL      string
	collection   string
	tenant       string
}

func NewRecommendationsClient(tm *TokenManager, baseURL, collection, tenant string) *RecommendationsClient {
	return &RecommendationsClient{tm, baseURL, collection, tenant}
}

func (c *RecommendationsClient) GetBase(query string, itemCount int) ([]RecommendationItemBase, error) {
	token, err := c.tokenManager.EnsureValidToken()
	if err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(RecommendationsRequest{
		Query:              query,
		ItemCount:          itemCount,
		CertaintyThreshold: 0.75,
		Collection:         c.collection,
		Tenant:             c.tenant,
	})

	req, _ := http.NewRequest("POST", c.baseURL, bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("base recommendations request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("base recommendations returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var items []RecommendationItemBase
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("failed to parse base recommendations response: %w", err)
	}
	return items, nil
}

// VerboseRecommendationsClient fetches publisher-scoped recommendations with snippet text.
type VerboseRecommendationsClient struct {
	tokenManager *TokenManager
	verboseURL   string
	collection   string
	tenant       string
}

func NewVerboseRecommendationsClient(tm *TokenManager, verboseURL, collection, tenant string) *VerboseRecommendationsClient {
	return &VerboseRecommendationsClient{tm, verboseURL, collection, tenant}
}

func (c *VerboseRecommendationsClient) GetVerbose(query string, itemCount int) ([]RecommendationItemVerbose, error) {
	token, err := c.tokenManager.EnsureValidToken()
	if err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(RecommendationsRequest{
		Query:              query,
		ItemCount:          itemCount,
		CertaintyThreshold: 0.75,
		Collection:         c.collection,
		Tenant:             c.tenant,
	})

	req, _ := http.NewRequest("POST", c.verboseURL, bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("verbose recommendations request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("verbose recommendations returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var items []RecommendationItemVerbose
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("failed to parse verbose recommendations response: %w", err)
	}
	return items, nil
}

// AffiliatesClient fetches items from across the Gloo affiliate publisher network.
type AffiliatesClient struct {
	tokenManager  *TokenManager
	affiliatesURL string
}

func NewAffiliatesClient(tm *TokenManager, affiliatesURL string) *AffiliatesClient {
	return &AffiliatesClient{tm, affiliatesURL}
}

func (c *AffiliatesClient) GetReferencedItems(query string, itemCount int) ([]AffiliateItem, error) {
	token, err := c.tokenManager.EnsureValidToken()
	if err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(AffiliatesRequest{
		Query:              query,
		ItemCount:          itemCount,
		CertaintyThreshold: 0.75,
	})

	req, _ := http.NewRequest("POST", c.affiliatesURL, bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("affiliates request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("affiliates returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var items []AffiliateItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("failed to parse affiliates response: %w", err)
	}
	return items, nil
}

// --- Command Functions ---

func runBase(query string, itemCount int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	client := NewRecommendationsClient(tm, recommendationsBaseURL, collection, tenant)

	fmt.Printf("Fetching recommendations for: %q\n", query)
	fmt.Printf("Collection: %s | Tenant: %s\n", collection, tenant)
	fmt.Printf("Requesting up to %d items\n\n", itemCount)

	items, err := client.GetBase(query, itemCount)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if len(items) == 0 {
		fmt.Println("No recommendations found.")
		return
	}

	fmt.Printf("Found %d item(s):\n\n", len(items))
	for i, item := range items {
		fmt.Printf("--- Item %d ---\n", i+1)
		fmt.Printf("Title:  %s\n", item.ItemTitle)

		if len(item.Author) > 0 {
			fmt.Printf("Author: %s\n", joinStrings(item.Author))
		}
		if item.ItemURL != "" {
			fmt.Printf("URL:    %s\n", item.ItemURL)
		}

		if len(item.UUIDs) > 0 {
			top := item.UUIDs[0]
			fmt.Printf("Relevance: %.0f%%\n", top.Certainty*100)
			if top.AITitle != "" {
				fmt.Printf("Section:   %s\n", top.AITitle)
			}
			if top.ItemSummary != "" {
				fmt.Printf("Summary:   %s\n", top.ItemSummary)
			}
		}
		fmt.Println()
	}
}

func runVerbose(query string, itemCount int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	client := NewVerboseRecommendationsClient(tm, recommendationsVerboseURL, collection, tenant)

	fmt.Printf("Fetching verbose recommendations for: %q\n", query)
	fmt.Printf("Collection: %s | Tenant: %s\n", collection, tenant)
	fmt.Printf("Requesting up to %d items\n\n", itemCount)

	items, err := client.GetVerbose(query, itemCount)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if len(items) == 0 {
		fmt.Println("No recommendations found.")
		return
	}

	fmt.Printf("Found %d item(s):\n\n", len(items))
	for i, item := range items {
		fmt.Printf("--- Item %d ---\n", i+1)
		fmt.Printf("Title:  %s\n", item.ItemTitle)

		if len(item.Author) > 0 {
			fmt.Printf("Author: %s\n", joinStrings(item.Author))
		}
		if item.ItemURL != "" {
			fmt.Printf("URL:    %s\n", item.ItemURL)
		}

		if len(item.UUIDs) > 0 {
			top := item.UUIDs[0]
			fmt.Printf("Relevance: %.0f%%\n", top.Certainty*100)
			if top.AITitle != "" {
				fmt.Printf("Section:   %s\n", top.AITitle)
			}
			if top.ItemSummary != "" {
				fmt.Printf("Summary:   %s\n", top.ItemSummary)
			}
			if top.Snippet != "" {
				preview := top.Snippet
				if len(preview) > 200 {
					preview = preview[:200] + "..."
				}
				fmt.Printf("Preview:   %q\n", preview)
			}
		}
		fmt.Println()
	}
}

func runAffiliates(query string, itemCount int) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	client := NewAffiliatesClient(tm, affiliatesURL)

	fmt.Printf("Fetching affiliate recommendations for: %q\n", query)
	fmt.Println("Searching across the Gloo affiliate network...")
	fmt.Printf("Requesting up to %d items\n\n", itemCount)

	items, err := client.GetReferencedItems(query, itemCount)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if len(items) == 0 {
		fmt.Println("No affiliate items found.")
		return
	}

	fmt.Printf("Found %d item(s) from across the affiliate network:\n\n", len(items))
	for i, item := range items {
		fmt.Printf("--- Item %d ---\n", i+1)
		fmt.Printf("Title:     %s\n", item.ItemTitle)

		if len(item.Author) > 0 {
			fmt.Printf("Author:    %s\n", joinStrings(item.Author))
		}
		if item.Tradition != "" {
			fmt.Printf("Tradition: %s\n", item.Tradition)
		}
		if item.ItemSubtitle != "" {
			fmt.Printf("Subtitle:  %s\n", item.ItemSubtitle)
		}
		if item.ItemURL != "" {
			fmt.Printf("URL:       %s\n", item.ItemURL)
		}
		fmt.Println()
	}
}

// --- Helpers ---

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func parseItemCount(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return defaultVal
	}
	if n > 50 {
		return 50
	}
	return n
}

func joinStrings(ss []string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += ", "
		}
		result += s
	}
	return result
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run . base <query> [item_count]")
	fmt.Println("  go run . verbose <query> [item_count]")
	fmt.Println("  go run . affiliates <query> [item_count]")
	fmt.Println("  go run . server")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println(`  go run . base "How do I deal with anxiety?"`)
	fmt.Println(`  go run . base "parenting teenagers" 3`)
	fmt.Println(`  go run . verbose "How do I deal with anxiety?"`)
	fmt.Println(`  go run . verbose "parenting teenagers" 3`)
	fmt.Println(`  go run . affiliates "How do I deal with anxiety?"`)
	fmt.Println(`  go run . affiliates "parenting teenagers" 3`)
	fmt.Println("  go run . server")
}

// --- Main ---

func main() {
	_ = godotenv.Load()

	clientID = getEnv("GLOO_CLIENT_ID", "")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "")
	tenant = getEnv("GLOO_TENANT", "")
	collection = getEnv("GLOO_COLLECTION", "GlooProd")
	defaultItemCount = getEnvInt("DEFAULT_ITEM_COUNT", 5)

	tokenURL = "https://platform.ai.gloo.com/oauth2/token"
	recommendationsBaseURL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base"
	recommendationsVerboseURL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose"
	affiliatesURL = "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items"

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "server":
		ValidateCredentials(clientID, clientSecret)
		startServer()

	case "base", "verbose", "affiliates":
		ValidateCredentials(clientID, clientSecret)
		if len(os.Args) < 3 {
			fmt.Fprintf(os.Stderr, "Error: query argument required\n\n")
			printUsage()
			os.Exit(1)
		}
		query := os.Args[2]
		itemCount := defaultItemCount
		if len(os.Args) >= 4 {
			itemCount = parseItemCount(os.Args[3], defaultItemCount)
		}
		switch command {
		case "base":
			runBase(query, itemCount)
		case "verbose":
			runVerbose(query, itemCount)
		case "affiliates":
			runAffiliates(query, itemCount)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}
