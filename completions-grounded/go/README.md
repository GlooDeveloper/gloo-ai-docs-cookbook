# Grounded Completions Recipe - Go

This Go implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- Go 1.21 or higher
- Gloo AI account with API key
- Publisher created in [Gloo Studio](https://studio.ai.gloo.com) with content uploaded

## Setup

1. **Install dependencies**:
   ```bash
   go mod download
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** with your credentials:
   - `GLOO_API_KEY`: Your API key from [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)
   - `PUBLISHER_NAME`: Name of your Publisher (default: "Bezalel")

## Running the Demo

```bash
go run main.go
```

Or build and run:
```bash
go build -o grounded-completions
./grounded-completions
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## How It Works

### Type Definitions
```go
type CompletionResponse struct {
    Choices []struct {
        Message struct {
            Content string `json:"content"`
        } `json:"message"`
    } `json:"choices"`
    SourcesReturned bool   `json:"sources_returned,omitempty"`
    Model           string `json:"model,omitempty"`
}
```

### Authentication
```go
// API key is read from environment and used directly as Bearer token
glooAPIKey = os.Getenv("GLOO_API_KEY")
req.Header.Set("Authorization", "Bearer "+glooAPIKey)
```

### Non-Grounded Request
```go
func makeNonGroundedRequest(query string) (*CompletionResponse, error) {
    // Standard completion WITHOUT RAG
    payload := CompletionRequest{
        Messages: []Message{
            {Role: "user", Content: query},
        },
        AutoRouting: true,
        MaxTokens:   500,
    }
    // POST to /ai/v2/chat/completions
}
```

### Grounded Request
```go
func makeGroundedRequest(query, publisher string, sourcesLimit int) (*CompletionResponse, error) {
    // Grounded completion WITH RAG
    payload := GroundedRequest{
        Messages: []Message{
            {Role: "user", Content: query},
        },
        AutoRouting:  true,
        RagPublisher: publisher,
        SourcesLimit: sourcesLimit,
        MaxTokens:    500,
    }
    // POST to /ai/v2/chat/completions/grounded
}
```

### Side-by-Side Comparison
```go
func compareResponses(query, publisher string) {
    // Compare both approaches for the same query
}
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```go
// Use more sources for complex queries
grounded, err := makeGroundedRequest(query, publisherName, 5)
```

### Add Custom Queries

```go
func main() {
    queries := []string{
        "Your custom question here",
        "Another question about your content",
    }

    for _, query := range queries {
        compareResponses(query, publisherName)
    }
}
```

### Use as a Package

```go
package main

import (
    "fmt"
    grounded "github.com/gloo-ai/grounded-completions-recipe"
)

func main() {
    result, err := grounded.MakeGroundedRequest(
        "Your query",
        "YourPublisher",
        3,
    )
    if err != nil {
        panic(err)
    }

    fmt.Println(result.Choices[0].Message.Content)
}
```

## Troubleshooting

### Module Download Errors
```bash
go mod tidy
go mod download
```

### Build Errors
```bash
go clean
go build
```

### Authentication Errors
- Verify `GLOO_API_KEY` is correct
- Check your API key at [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)

### Publisher Not Found
- Confirm publisher name matches exactly (case-sensitive)
- Verify publisher exists in [Gloo Studio](https://studio.ai.gloo.com)
- Ensure content is uploaded and indexed

### No Sources Returned
- Check that content is uploaded to the publisher
- Try increasing `sourcesLimit` parameter
- Verify query is relevant to uploaded content

### Network Timeouts
If you experience timeouts, you can adjust the HTTP client timeout:
```go
client := &http.Client{Timeout: 60 * time.Second}
```

## Learn More

- [Grounded Completions Recipe](https://docs.ai.gloo.com/tutorials/grounded-completions-recipe) - Full tutorial
- [Completions V2 API Guide](https://docs.ai.gloo.com/api-guides/completions-v2) - API documentation
- [Upload Content Tutorial](https://docs.ai.gloo.com/tutorials/upload-content) - Setting up Publishers
