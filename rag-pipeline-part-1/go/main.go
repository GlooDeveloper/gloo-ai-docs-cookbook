// Gloo AI RAG Pipeline - Part 1: Set Up the Pipeline (Go)
//
// Uploads sample content to a publisher, enriches it with metadata,
// and polls the Data Engine until the item is fully indexed.
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
	apiRoot         = "https://platform.ai.gloo.com"
	uploadURL       = apiRoot + "/ingestion/v2/files"
	itemMetadataURL = apiRoot + "/engine/v2/item"
	itemStatusURL   = apiRoot + "/engine/v2/items"

	sampleFile = "../sample_files/building-stronger-communities.md"
	producerID = "rag-pipeline-part1-building-stronger-communities"

	// Polling configuration: ingestion is asynchronous and typically
	// takes several minutes (observed ~6 minutes for a small file).
	pollInterval = 15 * time.Second
	pollTimeout  = 600 * time.Second
)

var (
	apiKey      string
	publisherID string
)

// UploadResponse is the Data Engine response to a file upload.
type UploadResponse struct {
	Success    bool     `json:"success"`
	Message    string   `json:"message"`
	Ingesting  []string `json:"ingesting"`
	Duplicates []string `json:"duplicates"`
}

// ItemMetadata is the subset of item metadata this recipe reports on.
type ItemMetadata struct {
	ItemID    string   `json:"item_id"`
	Status    string   `json:"status"`
	ItemTitle string   `json:"item_title"`
	Author    []string `json:"author"`
	ItemTags  []string `json:"item_tags"`
}

// PipelineSetup uploads content, sets metadata, and verifies indexing.
type PipelineSetup struct {
	apiKey string
}

// UploadFile uploads a single file and returns its item ID.
//
// A stable producer_id makes re-runs idempotent: if the same content
// was already uploaded, the API reports it as a duplicate and we
// reuse the existing item instead of creating a new one.
func (p *PipelineSetup) UploadFile(path string) (string, error) {
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

	uploadWithProducer := uploadURL + "?producer_id=" + url.QueryEscape(producerID)
	req, err := http.NewRequest(http.MethodPost, uploadWithProducer, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	body, err := doRequest(req)
	if err != nil {
		return "", fmt.Errorf("upload failed: %w", err)
	}

	var result UploadResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if len(result.Ingesting) > 0 {
		fmt.Printf("  Queued for ingestion: %s\n", result.Ingesting[0])
		return result.Ingesting[0], nil
	}
	if len(result.Duplicates) > 0 {
		fmt.Printf("  Already ingested (duplicate detected), reusing item: %s\n", result.Duplicates[0])
		return result.Duplicates[0], nil
	}
	return "", fmt.Errorf("unexpected upload response: %s", string(body))
}

// SetMetadata attaches descriptive metadata to the uploaded item.
func (p *PipelineSetup) SetMetadata(itemID string) error {
	tags := []string{"community", "service", "rag-pipeline-series"}
	metadata := map[string]any{
		"publisher_id": publisherID,
		"item_id":      itemID,
		"item_title":   "Building Stronger Communities Through Service",
		"item_summary": "Practical guidance for starting and sustaining community service efforts.",
		"author":       []string{"Gloo AI Docs Team"},
		"item_tags":    tags,
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPatch, itemMetadataURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	if _, err := doRequest(req); err != nil {
		return fmt.Errorf("metadata update failed: %w", err)
	}
	fmt.Printf("  Metadata set: title, summary, author, %d tags\n", len(tags))
	return nil
}

// GetItem fetches current item metadata, including ingestion status.
func (p *PipelineSetup) GetItem(itemID string) (*ItemMetadata, error) {
	req, err := http.NewRequest(http.MethodGet, itemStatusURL+"/"+itemID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	body, err := doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("status check failed: %w", err)
	}

	var item ItemMetadata
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

// WaitUntilIndexed polls item status until indexing completes or the timeout elapses.
func (p *PipelineSetup) WaitUntilIndexed(itemID string) (*ItemMetadata, error) {
	deadline := time.Now().Add(pollTimeout)
	lastStatus := ""

	for time.Now().Before(deadline) {
		item, err := p.GetItem(itemID)
		if err != nil {
			return nil, err
		}

		if item.Status != lastStatus {
			fmt.Printf("  Status: %s\n", item.Status)
			lastStatus = item.Status
		}

		// Terminal states (observed: CHUNKING while processing, COMPLETED when done).
		switch strings.ToUpper(item.Status) {
		case "COMPLETED":
			return item, nil
		case "FAILED", "ERROR":
			return nil, fmt.Errorf("ingestion failed with status: %s", item.Status)
		}

		time.Sleep(pollInterval)
	}

	return nil, fmt.Errorf("item %s not indexed within %s (last status: %s)", itemID, pollTimeout, lastStatus)
}

// doRequest executes a request and returns the body, treating HTTP >= 400 as an error.
func doRequest(req *http.Request) ([]byte, error) {
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

func main() {
	// .env is optional if variables are already exported.
	_ = godotenv.Load()

	apiKey = os.Getenv("GLOO_API_KEY")
	publisherID = os.Getenv("GLOO_PUBLISHER_ID")
	for name, value := range map[string]string{
		"GLOO_API_KEY":       apiKey,
		"GLOO_PUBLISHER_ID":  publisherID,
	} {
		if value == "" {
			log.Fatalf("Error: %s must be set. Copy .env.example to .env and fill in your values.", name)
		}
	}

	pipeline := &PipelineSetup{apiKey: apiKey}

	fmt.Println("Step 1: Uploading sample content...")
	itemID, err := pipeline.UploadFile(sampleFile)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nStep 2: Setting item metadata...")
	if err := pipeline.SetMetadata(itemID); err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nStep 3: Verifying indexing (polling)...")
	item, err := pipeline.WaitUntilIndexed(itemID)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("\nPipeline content is indexed and ready.")
	fmt.Printf("  Item ID:  %s\n", item.ItemID)
	fmt.Printf("  Title:    %s\n", item.ItemTitle)
	fmt.Printf("  Author:   %s\n", strings.Join(item.Author, ", "))
	fmt.Printf("  Tags:     %s\n", strings.Join(item.ItemTags, ", "))
	fmt.Printf("  Status:   %s\n", item.Status)
	fmt.Println("\nNext: query this content with the Search API, or ask questions about it")
	fmt.Println("with Grounded Completions (see the deep-dive recipes).")
}
