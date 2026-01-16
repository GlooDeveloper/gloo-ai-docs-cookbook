// Gloo AI Upload Files - Go Example
//
// This program demonstrates how to use the Gloo AI Data Engine Files API
// to upload files directly for processing and AI-powered search.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// --- Configuration ---
var (
	clientID     string
	clientSecret string
	publisherID  string

	tokenURL    = "https://platform.ai.gloo.com/oauth2/token"
	uploadURL   = "https://platform.ai.gloo.com/ingestion/v2/files"
	metadataURL = "https://platform.ai.gloo.com/engine/v2/item"

	supportedExtensions = map[string]bool{
		".txt":  true,
		".md":   true,
		".pdf":  true,
		".doc":  true,
		".docx": true,
	}
)

// --- Types ---
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

type UploadResponse struct {
	Success    bool     `json:"success"`
	Message    string   `json:"message"`
	Ingesting  []string `json:"ingesting"`
	Duplicates []string `json:"duplicates"`
}

type MetadataResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type Metadata struct {
	PublisherID string   `json:"publisher_id"`
	ItemID      string   `json:"item_id,omitempty"`
	ProducerID  string   `json:"producer_id,omitempty"`
	ItemTitle   string   `json:"item_title,omitempty"`
	Author      []string `json:"author,omitempty"`
	ItemTags    []string `json:"item_tags,omitempty"`
}

// --- State Management ---
var tokenInfo *TokenInfo

func init() {
	// Load .env file
	godotenv.Load()

	clientID = getEnv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
	publisherID = getEnv("GLOO_PUBLISHER_ID", "your-publisher-id")

	// Validate credentials
	if clientID == "YOUR_CLIENT_ID" || clientSecret == "YOUR_CLIENT_SECRET" ||
		clientID == "" || clientSecret == "" {
		fmt.Fprintln(os.Stderr, "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
		fmt.Println("Create a .env file with your credentials:")
		fmt.Println("GLOO_CLIENT_ID=your_client_id_here")
		fmt.Println("GLOO_CLIENT_SECRET=your_client_secret_here")
		fmt.Println("GLOO_PUBLISHER_ID=your_publisher_id_here")
		os.Exit(1)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// getAccessToken retrieves a new access token from the OAuth2 endpoint.
func getAccessToken() (*TokenInfo, error) {
	data := strings.NewReader("grant_type=client_credentials&scope=api/access")

	req, err := http.NewRequest("POST", tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to obtain token: %s - %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var token TokenInfo
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	token.ExpiresAt = time.Now().Unix() + int64(token.ExpiresIn)
	return &token, nil
}

// isTokenExpired checks if the current token is expired.
func isTokenExpired(token *TokenInfo) bool {
	if token == nil || token.ExpiresAt == 0 {
		return true
	}
	return time.Now().Unix() > (token.ExpiresAt - 60)
}

// ensureValidToken ensures we have a valid access token.
func ensureValidToken() (string, error) {
	if isTokenExpired(tokenInfo) {
		fmt.Println("Token is expired or missing. Fetching a new one...")
		var err error
		tokenInfo, err = getAccessToken()
		if err != nil {
			return "", err
		}
	}
	return tokenInfo.AccessToken, nil
}

// isSupportedFile checks if a file extension is supported.
func isSupportedFile(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	return supportedExtensions[ext]
}

// uploadSingleFile uploads a single file to the Data Engine.
func uploadSingleFile(filePath string, producerID string) (*UploadResponse, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("file not found: %s", filePath)
	}

	if !isSupportedFile(filePath) {
		return nil, fmt.Errorf("unsupported file type: %s", filepath.Ext(filePath))
	}

	token, err := ensureValidToken()
	if err != nil {
		return nil, err
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("files", filepath.Base(filePath))
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, file); err != nil {
		return nil, fmt.Errorf("failed to copy file: %w", err)
	}

	// Add publisher_id field
	if err := writer.WriteField("publisher_id", publisherID); err != nil {
		return nil, fmt.Errorf("failed to add publisher_id: %w", err)
	}

	writer.Close()

	targetURL := uploadURL
	if producerID != "" {
		u, _ := url.Parse(uploadURL)
		q := u.Query()
		q.Set("producer_id", producerID)
		u.RawQuery = q.Encode()
		targetURL = u.String()
	}

	req, err := http.NewRequest("POST", targetURL, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upload failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upload failed: %s - %s", resp.Status, string(respBody))
	}

	var result UploadResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// updateMetadata updates metadata for an uploaded item.
func updateMetadata(itemID, producerID string, metadata Metadata) (*MetadataResponse, error) {
	if itemID == "" && producerID == "" {
		return nil, fmt.Errorf("either itemID or producerID must be provided")
	}

	token, err := ensureValidToken()
	if err != nil {
		return nil, err
	}

	metadata.PublisherID = publisherID
	if itemID != "" {
		metadata.ItemID = itemID
	}
	if producerID != "" {
		metadata.ProducerID = producerID
	}

	jsonData, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	req, err := http.NewRequest("POST", metadataURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("metadata update failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("metadata update failed: %s - %s", resp.Status, string(respBody))
	}

	var result MetadataResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// cmdUploadSingle handles the single file upload command.
func cmdUploadSingle(filePath, producerID string) {
	fmt.Printf("Uploading: %s\n", filePath)
	if producerID != "" {
		fmt.Printf("  Producer ID: %s\n", producerID)
	}

	result, err := uploadSingleFile(filePath, producerID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Upload failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Upload successful!")
	fmt.Printf("  Message: %s\n", result.Message)

	if len(result.Ingesting) > 0 {
		fmt.Printf("  Ingesting: %d file(s)\n", len(result.Ingesting))
		for _, id := range result.Ingesting {
			fmt.Printf("    - %s\n", id)
		}
	}

	if len(result.Duplicates) > 0 {
		fmt.Printf("  Duplicates: %d file(s)\n", len(result.Duplicates))
		for _, id := range result.Duplicates {
			fmt.Printf("    - %s\n", id)
		}
	}
}

// cmdUploadBatch handles the batch upload command.
func cmdUploadBatch(directoryPath string) {
	info, err := os.Stat(directoryPath)
	if os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Directory does not exist: %s\n", directoryPath)
		os.Exit(1)
	}
	if !info.IsDir() {
		fmt.Fprintf(os.Stderr, "Path is not a directory: %s\n", directoryPath)
		os.Exit(1)
	}

	entries, err := os.ReadDir(directoryPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read directory: %v\n", err)
		os.Exit(1)
	}

	var supportedFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && isSupportedFile(entry.Name()) {
			supportedFiles = append(supportedFiles, entry.Name())
		}
	}

	if len(supportedFiles) == 0 {
		fmt.Printf("No supported files found in: %s\n", directoryPath)
		return
	}

	fmt.Printf("Found %d file(s) to upload\n", len(supportedFiles))

	processed := 0
	failed := 0

	for _, filename := range supportedFiles {
		filePath := filepath.Join(directoryPath, filename)
		fmt.Printf("\nUploading: %s\n", filename)

		result, err := uploadSingleFile(filePath, "")
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Failed: %v\n", err)
			failed++
		} else {
			if len(result.Ingesting) > 0 {
				fmt.Printf("  Ingesting: %s\n", result.Ingesting[0])
			} else if len(result.Duplicates) > 0 {
				fmt.Printf("  Duplicate detected: %s\n", result.Duplicates[0])
			} else {
				fmt.Printf("  Result: %s\n", result.Message)
			}
			processed++
		}

		// Rate limiting
		time.Sleep(1 * time.Second)
	}

	fmt.Printf("\nBatch upload complete:\n")
	fmt.Printf("  Processed: %d file(s)\n", processed)
	fmt.Printf("  Failed: %d file(s)\n", failed)
}

// cmdUploadWithMetadata handles the upload with metadata command.
func cmdUploadWithMetadata(filePath string, metadata Metadata) {
	producerID := fmt.Sprintf("upload-%d", time.Now().Unix())
	fmt.Printf("Uploading: %s\n", filePath)
	fmt.Printf("  Producer ID: %s\n", producerID)

	result, err := uploadSingleFile(filePath, producerID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Upload failed: %v\n", err)
		os.Exit(1)
	}

	if len(result.Ingesting) > 0 {
		itemID := result.Ingesting[0]
		fmt.Printf("  Item ID: %s\n", itemID)

		if metadata.ItemTitle != "" || len(metadata.Author) > 0 || len(metadata.ItemTags) > 0 {
			fmt.Println("Updating metadata...")
			metaResult, err := updateMetadata(itemID, "", metadata)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  Metadata update failed: %v\n", err)
			} else {
				fmt.Printf("  Metadata updated: %s\n", metaResult.Message)
			}
		}
	} else {
		fmt.Printf("  Result: %s\n", result.Message)
	}
}

// printUsage prints usage information.
func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run main.go single <file_path> [producer_id]  # Upload single file")
	fmt.Println("  go run main.go batch <directory>                  # Upload all files in directory")
	fmt.Println("  go run main.go meta <file_path> --title <title>   # Upload with metadata")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  go run main.go single ../sample_files/developer_happiness.txt")
	fmt.Println("  go run main.go single ../sample_files/developer_happiness.txt my-doc-001")
	fmt.Println("  go run main.go batch ../sample_files")
	fmt.Println("  go run main.go meta ../sample_files/developer_happiness.txt --title \"Developer Happiness\"")
}

// parseMetadataArgs parses metadata arguments from command line.
func parseMetadataArgs(args []string) Metadata {
	var metadata Metadata
	for i := 0; i < len(args); i++ {
		if args[i] == "--title" && i+1 < len(args) {
			metadata.ItemTitle = args[i+1]
			i++
		} else if args[i] == "--author" && i+1 < len(args) {
			metadata.Author = []string{args[i+1]}
			i++
		} else if args[i] == "--tags" && i+1 < len(args) {
			metadata.ItemTags = strings.Split(args[i+1], ",")
			i++
		}
	}
	return metadata
}

func main() {
	args := os.Args[1:]

	if len(args) < 1 {
		printUsage()
		os.Exit(1)
	}

	command := strings.ToLower(args[0])

	switch command {
	case "single":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "Error: Please specify a file to upload")
			printUsage()
			os.Exit(1)
		}
		producerID := ""
		if len(args) > 2 {
			producerID = args[2]
		}
		cmdUploadSingle(args[1], producerID)

	case "batch":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "Error: Please specify a directory")
			printUsage()
			os.Exit(1)
		}
		cmdUploadBatch(args[1])

	case "meta":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "Error: Please specify a file to upload")
			printUsage()
			os.Exit(1)
		}
		metadata := parseMetadataArgs(args[2:])
		cmdUploadWithMetadata(args[1], metadata)

	default:
		fmt.Fprintf(os.Stderr, "Error: Invalid command '%s'\n", command)
		printUsage()
		os.Exit(1)
	}
}
