// Gloo AI Search API - Proxy Server (Go)
//
// A lightweight HTTP server that proxies search requests to the Gloo AI API.
// The frontend calls this server instead of the Gloo API directly,
// keeping credentials secure on the server side.
//
// Start with:
//
//	go run . server
//
// Endpoints:
//
//	GET  /api/search?q=<query>&limit=<limit>  - Basic search
//	POST /api/search/rag                       - Search + RAG with Completions V2
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// RAGRequest is the JSON body for the RAG endpoint.
type RAGRequest struct {
	Query        string `json:"query"`
	Limit        int    `json:"limit"`
	SystemPrompt string `json:"systemPrompt"`
}

// RAGResponse is the JSON response from the RAG endpoint.
type RAGResponsePayload struct {
	Response string       `json:"response"`
	Sources  []SourceInfo `json:"sources"`
}

// SourceInfo is a source reference in the RAG response.
type SourceInfo struct {
	Title string `json:"title"`
	Type  string `json:"type"`
}

// ErrorResponse is a JSON error response.
type ErrorResponse struct {
	Error string `json:"error"`
}

func startServer(port string) {
	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	sc := &SearchClient{TokenManager: tm}
	rh := &RAGHelper{TokenManager: tm}

	frontendDir, _ := filepath.Abs(filepath.Join(".", "..", "frontend-example", "simple-html"))

	mux := http.NewServeMux()

	// API: Basic search
	mux.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		q := r.URL.Query().Get("q")
		if q == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "Query parameter 'q' is required"})
			return
		}

		limitStr := r.URL.Query().Get("limit")
		limit := 10
		if limitStr != "" {
			if parsed, err := strconv.Atoi(limitStr); err == nil {
				limit = parsed
			}
		}

		results, err := sc.Search(q, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Search error: %v\n", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "Search request failed"})
			return
		}

		json.NewEncoder(w).Encode(results)
	})

	// API: RAG search
	mux.HandleFunc("/api/search/rag", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		var body RAGRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Query == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "Field 'query' is required"})
			return
		}

		if body.Limit == 0 {
			body.Limit = 5
		}

		// Step 1: Search
		results, err := sc.Search(body.Query, body.Limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "RAG search error: %v\n", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "RAG request failed"})
			return
		}

		if len(results.Data) == 0 {
			json.NewEncoder(w).Encode(RAGResponsePayload{
				Response: "No relevant content found.",
				Sources:  []SourceInfo{},
			})
			return
		}

		// Step 2: Extract snippets and format context
		snippets := rh.ExtractSnippets(results, body.Limit, 500)
		context := rh.FormatContextForLLM(snippets)

		// Step 3: Generate response
		generatedResponse, err := rh.GenerateWithContext(body.Query, context, body.SystemPrompt)
		if err != nil {
			fmt.Fprintf(os.Stderr, "RAG generation error: %v\n", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "RAG request failed"})
			return
		}

		sources := make([]SourceInfo, len(snippets))
		for i, s := range snippets {
			sources[i] = SourceInfo{Title: s.Title, Type: s.Type}
		}

		json.NewEncoder(w).Encode(RAGResponsePayload{
			Response: generatedResponse,
			Sources:  sources,
		})
	})

	// Serve frontend static files
	fileServer := http.FileServer(http.Dir(frontendDir))
	mux.Handle("/", fileServer)

	fmt.Printf("Search API proxy server running at http://localhost:%s\n", port)
	fmt.Printf("Frontend available at http://localhost:%s\n", port)
	fmt.Printf("\nAPI endpoints:\n")
	fmt.Printf("  GET  http://localhost:%s/api/search?q=your+query&limit=10\n", port)
	fmt.Printf("  POST http://localhost:%s/api/search/rag\n", port)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server failed: %v\n", err)
		os.Exit(1)
	}
}

func init() {
	// Register "server" as a valid command by patching main's switch
	// This is handled in main() below
}

// addServerCommand patches into the main command dispatch.
// Called from main.go's main() function if command is "server".
func handleServerCommand() {
	port := "3000"
	for _, arg := range os.Args[2:] {
		if strings.HasPrefix(arg, "--port=") {
			port = strings.TrimPrefix(arg, "--port=")
		}
	}
	startServer(port)
}
