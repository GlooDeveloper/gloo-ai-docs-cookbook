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

// Suppress unused-import errors during step-by-step implementation.
var (
	_ = bufio.NewScanner
	_ = bytes.NewBuffer
	_ = json.Marshal
	_ = io.ReadAll
	_ = os.Getenv
	_ = auth.EnsureValidToken
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
	// 1. Configure CORS headers based on the PROXY_CORS_ORIGIN env var, handling OPTIONS requests
	// 2. Reject non-POST requests with a 405 Method Not Allowed error
	// 3. Set SSE-specific HTTP response headers (Content-Type, Cache-Control, X-Accel-Buffering)
	// 4. Verify the ResponseWriter supports the http.Flusher interface
	// 5. Ensure a valid auth token is available via auth.EnsureValidToken()
	// 6. Read and parse the incoming JSON request body, ensuring the 'stream' flag is set to true
	// 7. Construct and send the upstream POST request to the Gloo AI API with the token and payload
	// 8. Handle non-200 upstream responses by flushing an error data event to the client
	// 9. Read the upstream response body line-by-line using a bufio.Scanner and flush each non-empty line to the client
	fmt.Fprintf(w, "data: {\"error\": \"%s\"}\n\n", "not implemented - see TODO comments")
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
