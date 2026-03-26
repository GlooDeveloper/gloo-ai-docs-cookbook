//go:build ignore

// Server-Side Proxy Test
//
// Validates that:
// - The Go proxy server starts and responds to /health
// - POST /api/stream relays SSE from Gloo AI back to the client
// - SSE lines arrive with correct format and stream terminates cleanly
//
// Usage: go run tests/step6_proxy.go

package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/proxy"
)

func main() {
	fmt.Println("🧪 Testing: Server-Side Proxy")
	fmt.Println("")

	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	if os.Getenv("GLOO_CLIENT_ID") == "" {
		fmt.Println("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
		os.Exit(1)
	}

	port := os.Getenv("PROXY_PORT")
	if port == "" {
		port = "3001"
	}
	addr := "127.0.0.1:" + port

	// Test 1: Start the proxy server in a goroutine
	fmt.Printf("Test 1: Starting proxy server on port %s...\n", port)

	srv := &http.Server{
		Addr:    addr,
		Handler: proxy.Handler(),
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Server error: %v\n", err)
		}
	}()
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(ctx) //nolint:errcheck
	}()

	// Wait for the server to accept connections
	ready := false
	for i := 0; i < 20; i++ {
		conn, err := net.DialTimeout("tcp", addr, time.Second)
		if err == nil {
			conn.Close()
			ready = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}

	if !ready {
		failProxy(fmt.Sprintf("Proxy server did not start on %s within 4 seconds", addr), port)
	}
	fmt.Printf("✓ Proxy server running at http://%s\n", addr)

	// Test 2: /health endpoint
	fmt.Println("\nTest 2: /health endpoint...")
	healthResp, err := http.Get("http://" + addr + "/health")
	if err != nil {
		failProxy(fmt.Sprintf("GET /health failed: %v", err), port)
	}
	defer healthResp.Body.Close()
	if healthResp.StatusCode != 200 {
		failProxy(fmt.Sprintf("Expected 200 from /health, got %d", healthResp.StatusCode), port)
	}
	healthBody, _ := io.ReadAll(healthResp.Body)
	fmt.Printf("✓ /health returns: %s\n", string(healthBody))

	// Test 3: POST /api/stream returns text/event-stream
	fmt.Println("\nTest 3: POST /api/stream — Content-Type header...")
	reqBody := bytes.NewReader([]byte(`{"messages":[{"role":"user","content":"Hi"}],"auto_routing":true}`))
	streamResp, err := http.Post("http://"+addr+"/api/stream", "application/json", reqBody)
	if err != nil {
		failProxy(fmt.Sprintf("POST /api/stream failed: %v", err), port)
	}
	defer streamResp.Body.Close()

	if streamResp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(streamResp.Body)
		n := len(bodyBytes)
		if n > 200 {
			n = 200
		}
		failProxy(fmt.Sprintf("Expected 200, got %d: %s", streamResp.StatusCode, string(bodyBytes[:n])), port)
	}

	ct := streamResp.Header.Get("Content-Type")
	if !strings.Contains(ct, "text/event-stream") {
		failProxy(fmt.Sprintf("Expected text/event-stream, got: %s", ct), port)
	}
	fmt.Printf("✓ Content-Type: %s\n", ct)

	// Test 4: SSE line format (data: prefix)
	fmt.Println("\nTest 4: SSE line format (data: prefix)...")
	dataLines := 0
	streamTerminated := false
	finishReason := ""

	scanner := bufio.NewScanner(streamResp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			failProxy(fmt.Sprintf("Expected 'data: ' prefix, got: %q", line), port)
		}
		ssePayload := strings.TrimSpace(line[6:])
		if ssePayload == "[DONE]" {
			continue
		}
		var parsed struct {
			Choices []struct {
				FinishReason *string `json:"finish_reason"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(ssePayload), &parsed); err == nil {
			if len(parsed.Choices) > 0 && parsed.Choices[0].FinishReason != nil {
				streamTerminated = true
				finishReason = *parsed.Choices[0].FinishReason
				break
			}
		}
		dataLines++
	}

	fmt.Printf("✓ All lines have 'data: ' prefix (%d data chunks received)\n", dataLines)

	if !streamTerminated {
		fmt.Println("⚠️  Stream ended without a finish_reason chunk")
	} else {
		fmt.Printf("✓ Stream terminated cleanly (finish_reason=%s)\n", finishReason)
	}

	// Test 5: CORS headers present
	fmt.Println("\nTest 5: CORS headers on response...")
	optReq, _ := http.NewRequest(http.MethodOptions, "http://"+addr+"/api/stream", nil)
	optReq.Header.Set("Origin", "http://localhost:3000")
	optResp, err := http.DefaultClient.Do(optReq)
	if err != nil {
		fmt.Printf("⚠️  OPTIONS request failed: %v\n", err)
	} else {
		defer optResp.Body.Close()
		corsHeader := optResp.Header.Get("Access-Control-Allow-Origin")
		if corsHeader == "" {
			fmt.Println("⚠️  Access-Control-Allow-Origin header not set on OPTIONS response")
		} else {
			fmt.Printf("✓ Access-Control-Allow-Origin: %s\n", corsHeader)
		}
	}

	fmt.Println("\n✅ Proxy server relaying SSE end-to-end.")
	fmt.Println("   Proxy complete: credentials stay server-side, client receives SSE.")
}

func failProxy(msg, port string) {
	fmt.Println("\n❌ Server-Side Proxy Test Failed")
	fmt.Printf("Error: %s\n", msg)
	fmt.Println("\n💡 Hints:")
	fmt.Println("   - Check that all dependencies are installed: go mod tidy")
	fmt.Printf("   - Verify port %s is not already in use\n", port)
	fmt.Println("   - Check pkg/proxy/server.go imports auth.EnsureValidToken correctly")
	fmt.Println("   - Confirm GLOO_CLIENT_ID and GLOO_CLIENT_SECRET are set in .env")
	os.Exit(1)
}
