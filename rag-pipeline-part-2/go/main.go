// Gloo AI RAG Pipeline - Part 2: Content Lifecycle (Go)
//
// Seeds a small set of items, then demonstrates the content lifecycle:
// update a single item, bulk-edit several items, verify the changes, and
// delete the items (cleanup).
//
// Every mutation is scoped to the exact item IDs this recipe created —
// captured from the upload responses — so it never touches other content
// in the publisher.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
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
	itemURL   = apiRoot + "/engine/v2/item"  // single-item update (PATCH)
	itemsURL  = apiRoot + "/engine/v2/items" // bulk patch (PATCH), delete (DELETE)

	sampleDir = "../sample_files"

	// Ingestion is asynchronous and typically takes several minutes.
	pollInterval = 15 * time.Second
	pollTimeout  = 600 * time.Second

	// Edits succeed immediately, but the read path is eventually consistent:
	// a freshly patched item can take a few seconds to reflect the change on a
	// subsequent GET. Verification re-fetches until the change is visible.
	verifyAttempts = 20
	verifyInterval = 3 * time.Second
)

var (
	clientID     string
	clientSecret string
	publisherID  string
)

// SeedItem describes one piece of content this recipe manages. Producer IDs are
// stable identifiers you assign; here they share a prefix unique to this recipe.
type SeedItem struct {
	File        string
	ProducerID  string
	ItemTitle   string
	ItemSummary string
	Author      []string
	ItemTags    []string
}

func seedItems() []SeedItem {
	return []SeedItem{
		{
			File:        "volunteer-onboarding.md",
			ProducerID:  "rag-pipeline-part2-volunteer-onboarding",
			ItemTitle:   "Onboarding New Volunteers",
			ItemSummary: "How a warm, organized welcome turns newcomers into committed volunteers.",
			Author:      []string{"Gloo AI Docs Team"},
			ItemTags:    []string{"volunteers", "rag-pipeline-series"},
		},
		{
			File:        "measuring-community-impact.md",
			ProducerID:  "rag-pipeline-part2-measuring-impact",
			ItemTitle:   "Measuring Community Impact",
			ItemSummary: "Why measuring outcomes, not activity, sustains community programs.",
			Author:      []string{"Gloo AI Docs Team"},
			ItemTags:    []string{"measurement", "rag-pipeline-series"},
		},
		{
			File:        "sustaining-engagement.md",
			ProducerID:  "rag-pipeline-part2-sustaining-engagement",
			ItemTitle:   "Sustaining Long-Term Engagement",
			ItemSummary: "Practices that keep volunteers engaged through the long haul.",
			Author:      []string{"Gloo AI Docs Team"},
			ItemTags:    []string{"engagement", "rag-pipeline-series"},
		},
	}
}

// TokenManager manages OAuth2 client-credentials token lifecycle.
type TokenManager struct {
	accessToken string
	expiresAt   time.Time
}

// GetToken returns a valid access token, fetching a new one if needed.
func (tm *TokenManager) GetToken() (string, error) {
	if time.Now().Before(tm.expiresAt.Add(-60 * time.Second)) {
		return tm.accessToken, nil
	}
	form := url.Values{"grant_type": {"client_credentials"}, "scope": {"api/access"}}
	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	body, _, err := doRequest(req, false)
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &token); err != nil {
		return "", err
	}
	tm.accessToken = token.AccessToken
	tm.expiresAt = time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
	return tm.accessToken, nil
}

// ItemMetadata is the subset of item metadata this recipe reads.
type ItemMetadata struct {
	ItemID    string   `json:"item_id"`
	Status    string   `json:"status"`
	ItemTitle string   `json:"item_title"`
	Author    []string `json:"author"`
	ItemTags  []string `json:"item_tags"`
}

// PatchOp is a single bulk-patch operation.
type PatchOp struct {
	Op    string `json:"op"`
	Field string `json:"field"`
	Value any    `json:"value"`
}

// ContentLifecycle seeds content and performs scoped lifecycle operations on it.
type ContentLifecycle struct {
	tokens *TokenManager
}

func (c *ContentLifecycle) authorize(req *http.Request) error {
	token, err := c.tokens.GetToken()
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return nil
}

// UploadFile uploads a single file under a stable producer ID; returns its item ID.
// The upload response is the authoritative source of the item ID — keep it.
func (c *ContentLifecycle) UploadFile(path, producerID string) (string, error) {
	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	if err := writer.WriteField("publisher_id", publisherID); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("files", filepath.Base(path))
	if err != nil {
		return "", err
	}
	if _, err := part.Write(fileBytes); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost,
		uploadURL+"?producer_id="+url.QueryEscape(producerID), &buf)
	if err != nil {
		return "", err
	}
	if err := c.authorize(req); err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	body, _, err := doRequest(req, false)
	if err != nil {
		return "", fmt.Errorf("upload failed: %w", err)
	}
	var result struct {
		Ingesting  []string `json:"ingesting"`
		Duplicates []string `json:"duplicates"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	ids := append(result.Ingesting, result.Duplicates...)
	if len(ids) == 0 {
		return "", fmt.Errorf("unexpected upload response: %s", string(body))
	}
	return ids[0], nil
}

// SetMetadata sets metadata on a single item via PATCH /engine/v2/item.
func (c *ContentLifecycle) SetMetadata(itemID string, fields map[string]any) error {
	payload := map[string]any{"publisher_id": publisherID, "item_id": itemID}
	for k, v := range fields {
		payload[k] = v
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPatch, itemURL, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if err := c.authorize(req); err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if _, _, err := doRequest(req, false); err != nil {
		return fmt.Errorf("metadata update failed: %w", err)
	}
	return nil
}

// GetItem fetches current item metadata, including ingestion status.
func (c *ContentLifecycle) GetItem(itemID string) (*ItemMetadata, error) {
	req, err := http.NewRequest(http.MethodGet, itemsURL+"/"+itemID, nil)
	if err != nil {
		return nil, err
	}
	if err := c.authorize(req); err != nil {
		return nil, err
	}
	body, _, err := doRequest(req, false)
	if err != nil {
		return nil, fmt.Errorf("get item failed: %w", err)
	}
	var item ItemMetadata
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

// ItemExists reports whether the item can still be fetched (false once deleted).
func (c *ContentLifecycle) ItemExists(itemID string) (bool, error) {
	req, err := http.NewRequest(http.MethodGet, itemsURL+"/"+itemID, nil)
	if err != nil {
		return false, err
	}
	if err := c.authorize(req); err != nil {
		return false, err
	}
	_, status, err := doRequest(req, true)
	if err != nil {
		return false, err
	}
	return status != http.StatusNotFound, nil
}

// WaitUntilIndexed polls until every item reaches COMPLETED or the timeout elapses.
func (c *ContentLifecycle) WaitUntilIndexed(itemIDs []string) error {
	deadline := time.Now().Add(pollTimeout)
	pending := map[string]bool{}
	for _, id := range itemIDs {
		pending[id] = true
	}
	for len(pending) > 0 && time.Now().Before(deadline) {
		for id := range pending {
			item, err := c.GetItem(id)
			if err != nil {
				return err
			}
			switch strings.ToUpper(item.Status) {
			case "COMPLETED":
				delete(pending, id)
			case "FAILED", "ERROR":
				return fmt.Errorf("ingestion failed for %s: %s", id, item.Status)
			}
		}
		if len(pending) > 0 {
			fmt.Printf("  Waiting for %d item(s) to finish indexing...\n", len(pending))
			time.Sleep(pollInterval)
		}
	}
	if len(pending) > 0 {
		return fmt.Errorf("items not indexed within timeout")
	}
	return nil
}

// BulkPatch applies patch operations to a specific set of items (scoped by item_ids).
func (c *ContentLifecycle) BulkPatch(itemIDs []string, ops []PatchOp) (map[string]any, error) {
	payload, err := json.Marshal(map[string]any{
		"filter": map[string]any{"item_ids": itemIDs},
		"ops":    ops,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPatch,
		itemsURL+"?publisher_id="+url.QueryEscape(publisherID), bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	if err := c.authorize(req); err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	body, _, err := doRequest(req, false)
	if err != nil {
		return nil, fmt.Errorf("bulk patch failed: %w", err)
	}
	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// DeleteItems deletes a specific set of items by ID.
func (c *ContentLifecycle) DeleteItems(itemIDs []string) (map[string]any, error) {
	payload, err := json.Marshal(map[string][]string{"item_ids": itemIDs})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodDelete, itemsURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	if err := c.authorize(req); err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	body, _, err := doRequest(req, false)
	if err != nil {
		return nil, fmt.Errorf("delete failed: %w", err)
	}
	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetItemWithTag re-fetches an item until the given tag is visible (read-after-write retry).
func (c *ContentLifecycle) GetItemWithTag(itemID, tag string) (*ItemMetadata, error) {
	item, err := c.GetItem(itemID)
	if err != nil {
		return nil, err
	}
	for attempt := 0; attempt < verifyAttempts; attempt++ {
		if contains(item.ItemTags, tag) {
			return item, nil
		}
		time.Sleep(verifyInterval)
		item, err = c.GetItem(itemID)
		if err != nil {
			return nil, err
		}
	}
	return item, nil
}

// WaitUntilDeleted re-checks until the item is gone (GET 404), or attempts run out.
func (c *ContentLifecycle) WaitUntilDeleted(itemID string) (bool, error) {
	for attempt := 0; attempt < verifyAttempts; attempt++ {
		exists, err := c.ItemExists(itemID)
		if err != nil {
			return false, err
		}
		if !exists {
			return true, nil
		}
		time.Sleep(verifyInterval)
	}
	return false, nil
}

// doRequest executes a request and returns body and status. When allowNotFound
// is false, HTTP >= 400 is treated as an error.
func doRequest(req *http.Request, allowNotFound bool) ([]byte, int, error) {
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode >= 400 && !(allowNotFound && resp.StatusCode == http.StatusNotFound) {
		return nil, resp.StatusCode, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, resp.StatusCode, nil
}

func contains(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func numField(result map[string]any, key string) int {
	if v, ok := result[key].(float64); ok {
		return int(v)
	}
	return 0
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

	c := &ContentLifecycle{tokens: &TokenManager{}}
	seeds := seedItems()

	fmt.Println("Step 1: Seeding sample content...")
	// Capture each item's ID from its upload response — the authoritative handle
	// we scope every later operation to.
	mapping := map[string]string{}
	itemIDs := make([]string, 0, len(seeds))
	for _, item := range seeds {
		itemID, err := c.UploadFile(filepath.Join(sampleDir, item.File), item.ProducerID)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if err := c.SetMetadata(itemID, map[string]any{
			"item_title":   item.ItemTitle,
			"item_summary": item.ItemSummary,
			"author":       item.Author,
			"item_tags":    item.ItemTags,
		}); err != nil {
			log.Fatalf("Error: %v", err)
		}
		mapping[item.ProducerID] = itemID
		itemIDs = append(itemIDs, itemID)
		fmt.Printf("  Uploaded %s -> %s\n", item.ProducerID, itemID)
	}
	fmt.Println("  Waiting for ingestion to complete (this can take a few minutes)...")
	if err := c.WaitUntilIndexed(itemIDs); err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Println("  All seed items indexed.")

	fmt.Println("\nStep 2: Updating a single item...")
	targetProducer := "rag-pipeline-part2-volunteer-onboarding"
	if err := c.SetMetadata(mapping[targetProducer], map[string]any{
		"item_title":   "Onboarding New Volunteers: A First-Day Playbook",
		"item_summary": "A practical first-day checklist for welcoming and retaining new volunteers.",
	}); err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("  Updated title and summary for %s\n", targetProducer)

	fmt.Println("\nStep 3: Bulk-editing all seeded items...")
	reviewTag := "reviewed-q2-2026"
	result, err := c.BulkPatch(itemIDs, []PatchOp{
		{Op: "append", Field: "item_tags", Value: []string{reviewTag}},
		{Op: "replace", Field: "author", Value: []string{"Community Programs Team"}},
	})
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("  Matched %d, patched %d, failed %d\n",
		numField(result, "total_matched"), numField(result, "total_patched"), numField(result, "total_failed"))

	fmt.Println("\nStep 4: Verifying changes...")
	for _, item := range seeds {
		got, err := c.GetItemWithTag(mapping[item.ProducerID], reviewTag)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Printf("  %s\n", got.ItemTitle)
		fmt.Printf("    author: %s\n", strings.Join(got.Author, ", "))
		fmt.Printf("    tags:   %s\n", strings.Join(got.ItemTags, ", "))
	}

	fmt.Println("\nStep 5: Deleting items (cleanup)...")
	deletion, err := c.DeleteItems(itemIDs)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("  Requested %d, deleted %d, failed %d\n",
		numField(deletion, "total_requested"), numField(deletion, "total_deleted"), numField(deletion, "total_failed"))
	allGone := true
	for _, id := range itemIDs {
		gone, err := c.WaitUntilDeleted(id)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		allGone = allGone && gone
	}
	fmt.Printf("  All items confirmed deleted: %t\n", allGone)
	fmt.Println("\nLifecycle complete. The publisher is back to its pre-recipe state.")
}
