package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/joho/godotenv"
)

// Configuration constants
const (
	tokenURL    = "https://platform.ai.gloo.com/oauth2/token"
	apiURL      = "https://platform.ai.gloo.com/ingestion/v1/real_time_upload"
	publisherID = "your-publisher-id" // Replace with your publisher ID
)

var (
	clientID     string
	clientSecret string
	tokenInfo    *TokenInfo
)

// TokenInfo represents OAuth2 token information
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

// ContentData represents the content payload for API upload
type ContentData struct {
	Content         string   `json:"content"`
	PublisherID     string   `json:"publisherId"`
	ItemTitle       string   `json:"item_title"`
	Author          []string `json:"author"`
	PublicationDate string   `json:"publication_date"`
	Type            string   `json:"type"`
	PubType         string   `json:"pub_type"`
	ItemTags        []string `json:"item_tags"`
	Evergreen       bool     `json:"evergreen"`
	DRM             []string `json:"drm"`
}

// ApiResponse represents the API response structure
type ApiResponse struct {
	Success           bool        `json:"success"`
	Message           string      `json:"message"`
	TaskID            *string     `json:"task_id"`
	BatchID           *string     `json:"batch_id"`
	ProcessingDetails interface{} `json:"processing_details"`
}

// TokenManager handles OAuth2 token lifecycle
type TokenManager struct {
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

// NewTokenManager creates a new token manager instance
func NewTokenManager(clientID, clientSecret string) *TokenManager {
	return &TokenManager{
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetAccessToken retrieves a new access token from the OAuth2 endpoint
func (tm *TokenManager) GetAccessToken() (*TokenInfo, error) {
	data := strings.NewReader("grant_type=client_credentials&scope=api/access")
	req, err := http.NewRequest("POST", tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(tm.clientID, tm.clientSecret)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := tm.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get token: %s - %s", resp.Status, string(bodyBytes))
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var localTokenInfo TokenInfo
	if err := json.Unmarshal(body, &localTokenInfo); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token response: %w", err)
	}

	localTokenInfo.ExpiresAt = time.Now().Unix() + int64(localTokenInfo.ExpiresIn)
	return &localTokenInfo, nil
}

// IsTokenExpired checks if the token is expired or close to expiring
func (tm *TokenManager) IsTokenExpired(token *TokenInfo) bool {
	if token == nil || token.ExpiresAt == 0 {
		return true
	}
	return time.Now().Unix() > (token.ExpiresAt - 60) // 60 second buffer
}

// ContentProcessor handles content processing and uploads
type ContentProcessor struct {
	tokenManager  *TokenManager
	httpClient    *http.Client
	supportedExts map[string]bool
}

// NewContentProcessor creates a new content processor instance
func NewContentProcessor(tokenManager *TokenManager) *ContentProcessor {
	return &ContentProcessor{
		tokenManager: tokenManager,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		supportedExts: map[string]bool{
			".txt": true,
			".md":  true,
		},
	}
}

// IsSupportedFile checks if the file extension is supported
func (cp *ContentProcessor) IsSupportedFile(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	return cp.supportedExts[ext]
}

// ExtractTitleFromFilename extracts and formats title from filename
func (cp *ContentProcessor) ExtractTitleFromFilename(filename string) string {
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	name = strings.ReplaceAll(name, "_", " ")
	name = strings.ReplaceAll(name, "-", " ")

	// Simple title case implementation
	words := strings.Fields(name)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}

	return strings.Join(words, " ")
}

// CreateContentData creates properly formatted content data for API upload
func (cp *ContentProcessor) CreateContentData(content, title string) *ContentData {
	return &ContentData{
		Content:         content,
		PublisherID:     publisherID,
		ItemTitle:       title,
		Author:          []string{"Automated Ingestion"},
		PublicationDate: time.Now().Format("2006-01-02"),
		Type:            "Article",
		PubType:         "technical",
		ItemTags:        []string{"automated", "ingestion"},
		Evergreen:       true,
		DRM:             []string{"aspen", "kallm"},
	}
}

// UploadContent uploads content to the Realtime API
func (cp *ContentProcessor) UploadContent(contentData *ContentData) (*ApiResponse, error) {
	// Check and refresh token if needed
	if cp.tokenManager.IsTokenExpired(tokenInfo) {
		fmt.Println("Token is expired or missing. Fetching a new one...")
		var err error
		tokenInfo, err = cp.tokenManager.GetAccessToken()
		if err != nil {
			return nil, fmt.Errorf("failed to get access token: %w", err)
		}
	}

	jsonPayload, err := json.Marshal(contentData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal content data: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+tokenInfo.AccessToken)
	req.Header.Add("Content-Type", "application/json")

	resp, err := cp.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API call failed: %s - %s", resp.Status, string(body))
	}

	var result ApiResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// ProcessFile processes a single file and uploads its content
func (cp *ContentProcessor) ProcessFile(filePath string) error {
	// Validate file
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("file does not exist: %s", filePath)
	}

	if !cp.IsSupportedFile(filePath) {
		return fmt.Errorf("unsupported file type: %s", filePath)
	}

	// Read file content
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	if len(strings.TrimSpace(string(content))) == 0 {
		return fmt.Errorf("file is empty: %s", filePath)
	}

	// Extract metadata
	filename := filepath.Base(filePath)
	title := cp.ExtractTitleFromFilename(filename)
	contentData := cp.CreateContentData(string(content), title)

	// Upload content
	result, err := cp.UploadContent(contentData)
	if err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	fmt.Printf("✅ Successfully uploaded: %s\n", title)
	fmt.Printf("   Response: %s\n", result.Message)
	return nil
}

// DirectoryWatcher handles file system monitoring
type DirectoryWatcher struct {
	processor *ContentProcessor
}

// NewDirectoryWatcher creates a new directory watcher instance
func NewDirectoryWatcher(processor *ContentProcessor) *DirectoryWatcher {
	return &DirectoryWatcher{
		processor: processor,
	}
}

// Watch starts monitoring a directory for new files
func (dw *DirectoryWatcher) Watch(directory string) error {
	// Create directory if it doesn't exist
	if _, err := os.Stat(directory); os.IsNotExist(err) {
		if err := os.MkdirAll(directory, 0755); err != nil {
			return fmt.Errorf("failed to create directory: %w", err)
		}
		fmt.Printf("Created watch directory: %s\n", directory)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create watcher: %w", err)
	}
	defer watcher.Close()

	fmt.Printf("🔍 Monitoring directory: %s\n", directory)
	fmt.Println("   Supported file types: .txt, .md")
	fmt.Println("   Press Ctrl+C to stop")

	// Add directory to watcher
	err = watcher.Add(directory)
	if err != nil {
		return fmt.Errorf("failed to add directory to watcher: %w", err)
	}

	// Handle events
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return fmt.Errorf("watcher events channel closed")
			}

			if event.Op&fsnotify.Create == fsnotify.Create {
				if dw.processor.IsSupportedFile(event.Name) {
					fmt.Printf("📄 New file detected: %s\n", event.Name)
					// Small delay to ensure file write is complete
					time.Sleep(1 * time.Second)

					if err := dw.processor.ProcessFile(event.Name); err != nil {
						fmt.Printf("❌ Failed to process %s: %v\n", event.Name, err)
					}
				}
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return fmt.Errorf("watcher errors channel closed")
			}
			fmt.Printf("Watcher error: %v\n", err)
		}
	}
}

// BatchProcessor handles batch processing of directories
type BatchProcessor struct {
	processor *ContentProcessor
}

// NewBatchProcessor creates a new batch processor instance
func NewBatchProcessor(processor *ContentProcessor) *BatchProcessor {
	return &BatchProcessor{
		processor: processor,
	}
}

// ProcessDirectory processes all supported files in a directory
func (bp *BatchProcessor) ProcessDirectory(dirPath string) error {
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		return fmt.Errorf("directory does not exist: %s", dirPath)
	}

	// Find all supported files
	var supportedFiles []string

	txtFiles, err := filepath.Glob(filepath.Join(dirPath, "*.txt"))
	if err != nil {
		return fmt.Errorf("failed to glob txt files: %w", err)
	}
	supportedFiles = append(supportedFiles, txtFiles...)

	mdFiles, err := filepath.Glob(filepath.Join(dirPath, "*.md"))
	if err != nil {
		return fmt.Errorf("failed to glob md files: %w", err)
	}
	supportedFiles = append(supportedFiles, mdFiles...)

	if len(supportedFiles) == 0 {
		fmt.Printf("No supported files found in: %s\n", dirPath)
		return nil
	}

	fmt.Printf("Found %d files to process\n", len(supportedFiles))

	processed := 0
	failed := 0

	for _, file := range supportedFiles {
		if err := bp.processor.ProcessFile(file); err != nil {
			fmt.Printf("❌ Failed to process %s: %v\n", file, err)
			failed++
		} else {
			processed++
		}

		// Rate limiting - avoid overwhelming the API
		time.Sleep(1 * time.Second)
	}

	fmt.Printf("\n📊 Batch processing complete:\n")
	fmt.Printf("   ✅ Processed: %d files\n", processed)
	fmt.Printf("   ❌ Failed: %d files\n", failed)

	return nil
}

// Application represents the main application
type Application struct {
	tokenManager   *TokenManager
	processor      *ContentProcessor
	watcher        *DirectoryWatcher
	batchProcessor *BatchProcessor
}

// NewApplication creates a new application instance
func NewApplication() (*Application, error) {
	// Validate credentials
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
	}

	tokenManager := NewTokenManager(clientID, clientSecret)
	processor := NewContentProcessor(tokenManager)
	watcher := NewDirectoryWatcher(processor)
	batchProcessor := NewBatchProcessor(processor)

	return &Application{
		tokenManager:   tokenManager,
		processor:      processor,
		watcher:        watcher,
		batchProcessor: batchProcessor,
	}, nil
}

// PrintUsage prints application usage information
func (app *Application) PrintUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run main.go watch <directory>     # Monitor directory for new files")
	fmt.Println("  go run main.go batch <directory>     # Process all files in directory")
	fmt.Println("  go run main.go single <file_path>    # Process single file")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  go run main.go watch ./sample_content")
	fmt.Println("  go run main.go batch ./sample_content")
	fmt.Println("  go run main.go single ./sample_content/article.txt")
}

// ProcessSingleFile processes a single file
func (app *Application) ProcessSingleFile(filePath string) error {
	return app.processor.ProcessFile(filePath)
}

// StartWatching starts directory monitoring
func (app *Application) StartWatching(directory string) error {
	return app.watcher.Watch(directory)
}

// BatchProcess processes all files in a directory
func (app *Application) BatchProcess(directory string) error {
	return app.batchProcessor.ProcessDirectory(directory)
}

// getEnv returns environment variable value or fallback
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// validateCredentials checks that required credentials are provided
func validateCredentials() error {
	if clientID == "" || clientSecret == "" ||
		clientID == "YOUR_CLIENT_ID" || clientSecret == "YOUR_CLIENT_SECRET" {
		fmt.Println("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
		fmt.Println("Either:")
		fmt.Println("1. Create a .env file with your credentials:")
		fmt.Println("   GLOO_CLIENT_ID=your_client_id_here")
		fmt.Println("   GLOO_CLIENT_SECRET=your_client_secret_here")
		fmt.Println("2. Export them as environment variables:")
		fmt.Println("   export GLOO_CLIENT_ID=\"your_client_id_here\"")
		fmt.Println("   export GLOO_CLIENT_SECRET=\"your_client_secret_here\"")
		return fmt.Errorf("missing or invalid credentials")
	}
	return nil
}

// Initialize loads environment variables and validates configuration
func init() {
	// Load environment variables from .env file if it exists
	if err := godotenv.Load(); err != nil {
		// .env file is optional, so we don't fail here
	}

	// Get credentials from environment
	clientID = getEnv("GLOO_CLIENT_ID", "")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "")
}

func main() {
	// Validate credentials
	if err := validateCredentials(); err != nil {
		os.Exit(1)
	}

	// Create application
	app, err := NewApplication()
	if err != nil {
		fmt.Printf("Failed to create application: %v\n", err)
		os.Exit(1)
	}

	// Parse command line arguments
	if len(os.Args) < 2 {
		app.PrintUsage()
		os.Exit(1)
	}

	command := strings.ToLower(os.Args[1])

	switch command {
	case "watch":
		if len(os.Args) < 3 {
			fmt.Println("Error: Please specify a directory to watch")
			app.PrintUsage()
			os.Exit(1)
		}

		if err := app.StartWatching(os.Args[2]); err != nil {
			fmt.Printf("Error watching directory: %v\n", err)
			os.Exit(1)
		}

	case "batch":
		if len(os.Args) < 3 {
			fmt.Println("Error: Please specify a directory to process")
			app.PrintUsage()
			os.Exit(1)
		}

		if err := app.BatchProcess(os.Args[2]); err != nil {
			fmt.Printf("Error processing directory: %v\n", err)
			os.Exit(1)
		}

	case "single":
		if len(os.Args) < 3 {
			fmt.Println("Error: Please specify a file to process")
			app.PrintUsage()
			os.Exit(1)
		}

		if err := app.ProcessSingleFile(os.Args[2]); err != nil {
			fmt.Printf("Error processing file: %v\n", err)
			os.Exit(1)
		}

	default:
		fmt.Printf("Error: Invalid command '%s'\n", command)
		app.PrintUsage()
		os.Exit(1)
	}
}
