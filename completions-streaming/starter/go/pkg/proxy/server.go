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
	// TODO: Implement the Go SSE proxy handler (Step 8):
	// 1. Set SSE response headers: Content-Type: text/event-stream, Cache-Control: no-cache,
	//    X-Accel-Buffering: no
	// 2. Get http.Flusher from w to enable streaming: flusher, ok := w.(http.Flusher)
	// 3. Reject non-POST requests with 405
	// 4. Read and parse request body JSON
	// 5. Get auth token: token, err := auth.EnsureValidToken()
	// 6. Add stream: true to the upstream payload
	// 7. POST to API_URL with Authorization header
	// 8. Use bufio.NewScanner(upstreamResp.Body) to read line by line:
	//    a. For non-blank lines: fmt.Fprintf(w, "%s\n\n", line); flusher.Flush()
	// 9. Handle errors by writing SSE error frames
	fmt.Fprintf(w, "data: {\"error\": \"not implemented\"}\n\n")
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
