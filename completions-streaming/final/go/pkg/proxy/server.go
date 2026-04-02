// Package proxy provides an HTTP proxy server that relays SSE streams
// from the Gloo AI completions API to browser clients.
package proxy

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"completions-streaming/pkg/auth"
)

const apiURL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

// Handler returns an http.Handler that proxies SSE completion requests.
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/stream", streamProxy)
	mux.HandleFunc("/health", healthCheck)
	return mux
}

// streamProxy relays a streaming completion request to Gloo AI and
// forwards the SSE stream back to the browser client.
//
// Sets the required SSE headers:
//   - Content-Type: text/event-stream
//   - Cache-Control: no-cache
//   - X-Accel-Buffering: no
func streamProxy(w http.ResponseWriter, r *http.Request) {
	corsOrigin := os.Getenv("PROXY_CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:3000"
	}
	w.Header().Set("Access-Control-Allow-Origin", corsOrigin)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	token, err := auth.EnsureValidToken()
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"%s\"}\n\n", err.Error())
		flusher.Flush()
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"failed to read request body\"}\n\n")
		flusher.Flush()
		return
	}

	var reqBody map[string]any
	if err := json.Unmarshal(body, &reqBody); err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"invalid JSON body\"}\n\n")
		flusher.Flush()
		return
	}
	reqBody["stream"] = true

	payload, err := json.Marshal(reqBody)
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"failed to encode payload\"}\n\n")
		flusher.Flush()
		return
	}

	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"failed to create upstream request\"}\n\n")
		flusher.Flush()
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\": \"%s\"}\n\n", err.Error())
		flusher.Flush()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(w, "data: {\"error\": \"API error %d: %s\"}\n\n",
			resp.StatusCode, string(errBody[:min(len(errBody), 100)]))
		flusher.Flush()
		return
	}

	// Forward each SSE line to the client
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			fmt.Fprintf(w, "%s\n\n", line)
			flusher.Flush()
		}
	}
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"status":"ok","service":"completions-streaming-proxy"}`)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// StartServer starts the proxy HTTP server on the given address.
func StartServer(addr string) error {
	log.Printf("Proxy server running at http://%s", addr)
	return http.ListenAndServe(addr, Handler())
}
