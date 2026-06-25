// Gloo AI RAG Pipeline - Part 3: Verification, Error Handling & Resilience (Go)
//
// Builds a small resilient API client and demonstrates three production
// concerns against the Gloo AI Data Engine:
//
//  1. Interpreting structured API error responses (status, code, message)
//  2. Retrying transient failures with exponential backoff
//  3. Verifying ingestion health, handling missing items gracefully
//
// There are no monitoring or health-check endpoints — resilience here is built
// from the same item APIs used in Parts 1 and 2, plus disciplined error handling.
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	neturl "net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	apiRoot   = "https://platform.ai.gloo.com"
	tokenURL  = apiRoot + "/oauth2/token"
	uploadURL = apiRoot + "/ingestion/v2/files"
	itemsURL  = apiRoot + "/engine/v2/items"

	sampleDir = "../sample_files"

	maxRetries       = 4
	baseDelaySeconds = 1

	pollInterval = 15 * time.Second
	pollTimeout  = 600 * time.Second
)

// Retry policy: only transient failures are retried. Client errors (400, 401,
// 403, 404, 422) are bugs in the request, not blips, so they fail fast.
var retryableStatuses = []int{500, 502, 503, 504}

var reasonPhrases = map[int]string{
	400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
	422: "Unprocessable Entity", 500: "Internal Server Error", 502: "Bad Gateway",
	503: "Service Unavailable", 504: "Gateway Timeout",
}

type seedItem struct{ file, producerID string }

var seedItemsList = []seedItem{
	{"strengthening-feedback-loops.md", "rag-pipeline-part3-feedback-loops"},
	{"learning-from-incidents.md", "rag-pipeline-part3-incident-reviews"},
}

var (
	clientID     string
	clientSecret string
	publisherID  string
	httpClient   = &http.Client{Timeout: 120 * time.Second}
)

// ApiError is a normalized API error: HTTP status (0 for network failures), a
// machine-readable code, and a human-readable message.
type ApiError struct {
	Status  int
	Code    string
	Message string
}

func (e *ApiError) Error() string {
	return fmt.Sprintf("[%d %s] %s", e.Status, e.Code, e.Message)
}

// IsRetryable reports whether the error is a network failure or a transient status.
func (e *ApiError) IsRetryable() bool {
	if e.Status == 0 {
		return true
	}
	return containsInt(retryableStatuses, e.Status)
}

// TokenManager manages OAuth2 client-credentials token lifecycle.
type TokenManager struct {
	accessToken string
	expiresAt   time.Time
}

// GetToken returns a valid access token, fetching a new one if needed.
func (tm *TokenManager) GetToken() (string, error) {
	if tm.accessToken != "" && time.Now().Before(tm.expiresAt.Add(-60*time.Second)) {
		return tm.accessToken, nil
	}
	form := neturl.Values{"grant_type": {"client_credentials"}, "scope": {"api/access"}}
	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("token request failed: HTTP %d", resp.StatusCode)
	}
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return "", err
	}
	tm.accessToken = token.AccessToken
	tm.expiresAt = time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
	return tm.accessToken, nil
}

// ForceRefresh drops the cached token so the next call fetches a fresh one.
func (tm *TokenManager) ForceRefresh() {
	tm.accessToken = ""
}

type requestOpts struct {
	json            any
	params          map[string]string
	token           string
	disallowRefresh bool
}

// ResilientClient is a thin HTTP client with structured error parsing,
// retry-with-backoff, and one-shot token refresh on 401.
type ResilientClient struct {
	tokens *TokenManager
}

// parseError extracts (code, message) from the API's error shapes:
// {"detail": {"code", "message"}}, {"detail": "..."}, {"error", "message"}.
func (c *ResilientClient) parseError(status int, body []byte) (string, string) {
	reason := reasonPhrases[status]
	if reason == "" {
		reason = fmt.Sprintf("HTTP %d", status)
	}
	var decoded map[string]any
	if json.Unmarshal(body, &decoded) != nil {
		text := strings.TrimSpace(string(body))
		if text == "" {
			return "", reason
		}
		if len(text) > 200 {
			text = text[:200]
		}
		return "", text
	}
	if detail, ok := decoded["detail"].(map[string]any); ok {
		return str(detail["code"]), orReason(str(detail["message"]), reason)
	}
	if detail, ok := decoded["detail"].(string); ok {
		return "", detail
	}
	if _, ok := decoded["error"]; ok {
		return str(decoded["error"]), orReason(str(decoded["message"]), reason)
	}
	if _, ok := decoded["message"]; ok {
		return str(decoded["error"]), orReason(str(decoded["message"]), reason)
	}
	return "", reason
}

func (c *ResilientClient) backoff(attempt, status int, code string) {
	delay := time.Duration(baseDelaySeconds*(1<<attempt)) * time.Second
	label := "network error"
	if status != 0 {
		label = fmt.Sprintf("%d", status)
	}
	fmt.Printf("    Attempt %d failed (%s: %s); retrying in %ds\n", attempt+1, label, code, int(delay.Seconds()))
	time.Sleep(delay)
}

// request sends a request, retrying transient failures and refreshing the token
// once on 401. Returns an *ApiError on non-retryable failures or exhausted retries.
func (c *ResilientClient) request(method, url string, opts requestOpts) (map[string]any, error) {
	target := url
	if len(opts.params) > 0 {
		q := neturl.Values{}
		for k, v := range opts.params {
			q.Set(k, v)
		}
		target += "?" + q.Encode()
	}
	var payload []byte
	if opts.json != nil {
		payload, _ = json.Marshal(opts.json)
	}
	refreshed := false

	for attempt := 0; attempt <= maxRetries; attempt++ {
		bearer := opts.token
		if bearer == "" {
			t, err := c.tokens.GetToken()
			if err != nil {
				return nil, err
			}
			bearer = t
		}
		var body io.Reader
		if payload != nil {
			body = bytes.NewReader(payload)
		}
		req, _ := http.NewRequest(method, target, body)
		req.Header.Set("Authorization", "Bearer "+bearer)
		req.Header.Set("Content-Type", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			if attempt < maxRetries {
				c.backoff(attempt, 0, "connection")
				continue
			}
			return nil, &ApiError{0, "network_error", err.Error()}
		}
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		status := resp.StatusCode

		if status == 401 && !opts.disallowRefresh && !refreshed {
			refreshed = true
			c.tokens.ForceRefresh()
			continue
		}
		if containsInt(retryableStatuses, status) && attempt < maxRetries {
			code, _ := c.parseError(status, bodyBytes)
			c.backoff(attempt, status, code)
			continue
		}
		if status >= 400 {
			code, message := c.parseError(status, bodyBytes)
			return nil, &ApiError{status, code, message}
		}
		var result map[string]any
		if len(bodyBytes) > 0 {
			json.Unmarshal(bodyBytes, &result)
		}
		return result, nil
	}
	return nil, &ApiError{0, "retries_exhausted", "Exhausted retries"}
}

// callWithRetry runs an operation, retrying it on retryable ApiError with backoff.
func (c *ResilientClient) callWithRetry(operation func() (map[string]any, error), label string) (map[string]any, error) {
	for attempt := 0; attempt <= maxRetries; attempt++ {
		result, err := operation()
		if err == nil {
			return result, nil
		}
		var apiErr *ApiError
		if errors.As(err, &apiErr) && apiErr.IsRetryable() && attempt < maxRetries {
			c.backoff(attempt, apiErr.Status, apiErr.Code)
			continue
		}
		return nil, err
	}
	return nil, &ApiError{0, "retries_exhausted", "Exhausted retries for " + label}
}

// uploadFile uploads a single file, retrying transient failures (5xx or network blips).
func (c *ResilientClient) uploadFile(path, producerID string) (string, error) {
	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	operation := func() (map[string]any, error) {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		writer.WriteField("publisher_id", publisherID)
		part, _ := writer.CreateFormFile("files", filepath.Base(path))
		part.Write(fileBytes)
		writer.Close()

		token, err := c.tokens.GetToken()
		if err != nil {
			return nil, err
		}
		req, _ := http.NewRequest(http.MethodPost,
			uploadURL+"?producer_id="+neturl.QueryEscape(producerID), &buf)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, &ApiError{0, "network_error", err.Error()}
		}
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			code, message := c.parseError(resp.StatusCode, bodyBytes)
			return nil, &ApiError{resp.StatusCode, code, message}
		}
		var result map[string]any
		json.Unmarshal(bodyBytes, &result)
		return result, nil
	}
	result, err := c.callWithRetry(operation, "upload")
	if err != nil {
		return "", err
	}
	return firstID(result), nil
}

func (c *ResilientClient) getItem(itemID string) (map[string]any, error) {
	return c.request(http.MethodGet, itemsURL+"/"+itemID, requestOpts{})
}

func (c *ResilientClient) deleteItems(itemIDs []string) (map[string]any, error) {
	return c.request(http.MethodDelete, itemsURL, requestOpts{json: map[string]any{"item_ids": itemIDs}})
}

func (c *ResilientClient) waitUntilIndexed(itemIDs []string) error {
	deadline := time.Now().Add(pollTimeout)
	pending := map[string]bool{}
	for _, id := range itemIDs {
		pending[id] = true
	}
	for len(pending) > 0 && time.Now().Before(deadline) {
		for id := range pending {
			item, err := c.getItem(id)
			if err != nil {
				return err
			}
			switch strings.ToUpper(str(item["status"])) {
			case "COMPLETED":
				delete(pending, id)
			case "FAILED", "ERROR":
				return &ApiError{0, "ingestion_failed", id + ": " + str(item["status"])}
			}
		}
		if len(pending) > 0 {
			fmt.Printf("  Waiting for %d item(s) to finish indexing...\n", len(pending))
			time.Sleep(pollInterval)
		}
	}
	if len(pending) > 0 {
		return &ApiError{0, "ingestion_timeout", "Not indexed within timeout"}
	}
	return nil
}

// demoErrorHandling triggers representative error responses and shows the parsed result.
func demoErrorHandling(c *ResilientClient) error {
	cases := []struct {
		label, method, url string
		opts               requestOpts
	}{
		{"Missing item (random UUID)", http.MethodGet, itemsURL + "/" + newUUID(), requestOpts{}},
		{"Malformed item ID", http.MethodGet, itemsURL + "/not-a-valid-uuid", requestOpts{}},
		{"Rejected bearer token", http.MethodGet, itemsURL + "/" + newUUID(),
			requestOpts{token: "invalid-token", disallowRefresh: true}},
	}
	for _, tc := range cases {
		_, err := c.request(tc.method, tc.url, tc.opts)
		if err == nil {
			fmt.Printf("  %s: unexpectedly succeeded\n", tc.label)
			continue
		}
		var e *ApiError
		if errors.As(err, &e) {
			fmt.Printf("  %s: status=%d code='%s' message='%s'\n", tc.label, e.Status, e.Code, e.Message)
		} else {
			return err
		}
	}
	return nil
}

// demoRetry shows the backoff policy recovering from transient failures.
// Simulates a service returning 503 twice before succeeding — the same path a
// real 5xx or network error would take.
func demoRetry(c *ResilientClient) error {
	calls := 0
	flaky := func() (map[string]any, error) {
		calls++
		if calls < 3 {
			return nil, &ApiError{503, "service_unavailable", "Service temporarily unavailable"}
		}
		return map[string]any{"ok": true}, nil
	}
	if _, err := c.callWithRetry(flaky, "sample operation"); err != nil {
		return err
	}
	fmt.Printf("  Succeeded after %d attempts\n", calls)
	return nil
}

// demoHealthCheck uploads a batch, confirms each item indexed, and reports a
// health summary that also surfaces a missing item.
func demoHealthCheck(c *ResilientClient) error {
	fmt.Println("  Uploading and indexing a batch...")
	var itemIDs []string
	for _, si := range seedItemsList {
		id, err := c.uploadFile(filepath.Join(sampleDir, si.file), si.producerID)
		if err != nil {
			return err
		}
		itemIDs = append(itemIDs, id)
	}
	if err := c.waitUntilIndexed(itemIDs); err != nil {
		return err
	}

	toCheck := append(append([]string{}, itemIDs...), newUUID())
	completed, pending, failed, notFound := 0, 0, 0, 0
	for _, id := range toCheck {
		item, err := c.getItem(id)
		if err != nil {
			var e *ApiError
			if errors.As(err, &e) && e.Status == 404 {
				notFound++
				continue
			}
			return err
		}
		switch strings.ToUpper(str(item["status"])) {
		case "COMPLETED":
			completed++
		case "FAILED", "ERROR":
			failed++
		default:
			pending++
		}
	}
	fmt.Printf("  Health: %d completed, %d pending, %d failed, %d not found\n",
		completed, pending, failed, notFound)

	if _, err := c.deleteItems(itemIDs); err != nil {
		return err
	}
	fmt.Printf("  Cleaned up %d item(s)\n", len(itemIDs))
	return nil
}

func main() {
	_ = godotenv.Load()
	clientID = os.Getenv("GLOO_CLIENT_ID")
	clientSecret = os.Getenv("GLOO_CLIENT_SECRET")
	publisherID = os.Getenv("GLOO_PUBLISHER_ID")
	for name, value := range map[string]string{
		"GLOO_CLIENT_ID":     clientID,
		"GLOO_CLIENT_SECRET": clientSecret,
		"GLOO_PUBLISHER_ID":  publisherID,
	} {
		if value == "" {
			log.Fatalf("Error: %s must be set. Copy .env.example to .env and fill in your values.", name)
		}
	}

	c := &ResilientClient{tokens: &TokenManager{}}

	fmt.Println("Step 1: Resilient client ready (token refresh, error parsing, retry/backoff).")

	fmt.Println("\nStep 2: Interpreting API error responses...")
	if err := demoErrorHandling(c); err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nStep 3: Retrying transient failures with backoff...")
	if err := demoRetry(c); err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nStep 4: Verifying ingestion health...")
	if err := demoHealthCheck(c); err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nDone. The resilient client handled errors, retries, and verification end to end.")
}

// --- small helpers ---

func containsInt(items []int, target int) bool {
	for _, v := range items {
		if v == target {
			return true
		}
	}
	return false
}

func str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func orReason(s, reason string) string {
	if s == "" {
		return reason
	}
	return s
}

func firstID(result map[string]any) string {
	for _, key := range []string{"ingesting", "duplicates"} {
		if arr, ok := result[key].([]any); ok && len(arr) > 0 {
			if s, ok := arr[0].(string); ok {
				return s
			}
		}
	}
	return ""
}

func newUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
