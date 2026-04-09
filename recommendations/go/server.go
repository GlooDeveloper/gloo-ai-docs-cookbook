package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

func startServer() {
	port := getEnv("PORT", "3000")

	tm := NewTokenManager(clientID, clientSecret, tokenURL)
	baseClient := NewRecommendationsClient(tm, recommendationsBaseURL, collection, tenant)
	verboseClient := NewVerboseRecommendationsClient(tm, recommendationsVerboseURL, collection, tenant)
	affiliatesClient := NewAffiliatesClient(tm, affiliatesURL)

	mux := http.NewServeMux()

	// POST /api/recommendations/base
	mux.HandleFunc("/api/recommendations/base", func(w http.ResponseWriter, r *http.Request) {
		setCORSHeaders(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, query, itemCount, ok := parseRecommendRequest(w, r)
		_ = body
		if !ok {
			return
		}

		items, err := baseClient.GetBase(query, itemCount)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Base recommendations error: %v\n", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Base recommendations request failed"})
			return
		}
		writeJSON(w, http.StatusOK, items)
	})

	// POST /api/recommendations/verbose
	mux.HandleFunc("/api/recommendations/verbose", func(w http.ResponseWriter, r *http.Request) {
		setCORSHeaders(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, query, itemCount, ok := parseRecommendRequest(w, r)
		_ = body
		if !ok {
			return
		}

		items, err := verboseClient.GetVerbose(query, itemCount)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Verbose recommendations error: %v\n", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Verbose recommendations request failed"})
			return
		}
		writeJSON(w, http.StatusOK, items)
	})

	// POST /api/recommendations/affiliates
	mux.HandleFunc("/api/recommendations/affiliates", func(w http.ResponseWriter, r *http.Request) {
		setCORSHeaders(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, query, itemCount, ok := parseRecommendRequest(w, r)
		_ = body
		if !ok {
			return
		}

		items, err := affiliatesClient.GetReferencedItems(query, itemCount)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Affiliates error: %v\n", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Affiliates request failed"})
			return
		}
		writeJSON(w, http.StatusOK, items)
	})

	// Serve frontend static files
	_, filename, _, _ := runtime.Caller(0)
	goDir := filepath.Dir(filename)
	frontendDir := filepath.Join(goDir, "..", "frontend-example", "simple-html")
	if info, err := os.Stat(frontendDir); err == nil && info.IsDir() {
		mux.Handle("/", http.FileServer(http.Dir(frontendDir)))
	}

	addr := ":" + port
	fmt.Printf("Server running at http://localhost%s\n", addr)
	fmt.Println("Press Ctrl+C to stop.")
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}

// parseRecommendRequest decodes the JSON body and returns query + item_count.
func parseRecommendRequest(w http.ResponseWriter, r *http.Request) (map[string]interface{}, string, int, bool) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return nil, "", 0, false
	}

	query, _ := body["query"].(string)
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Field 'query' is required"})
		return nil, "", 0, false
	}

	itemCount := defaultItemCount
	if raw, ok := body["item_count"]; ok {
		switch v := raw.(type) {
		case float64:
			itemCount = parseItemCount(fmt.Sprintf("%.0f", v), defaultItemCount)
		case string:
			itemCount = parseItemCount(v, defaultItemCount)
		}
	}

	return body, query, itemCount, true
}

func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
