# Gloo AI Chat Message Tutorial - Go

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using Go with idiomatic Go patterns and best practices.

## Features

- API key authentication
- Idiomatic Go code with proper error handling
- Go modules for dependency management
- Create new chat sessions
- Continue conversations with context
- Retrieve and display chat history
- Comprehensive error handling with custom error types
- Environment validation and configuration
- Formatted timestamp display
- Human flourishing conversation examples

## Prerequisites

- Go 1.21 or higher
- Gloo AI API key

## Setup

1. **Initialize Go modules (if not already done):**
   ```bash
   go mod init gloo-chat-tutorial
   go mod tidy
   ```

2. **Install dependencies:**
   ```bash
   go get github.com/joho/godotenv
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```env
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them in your shell:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

   You can get your API key from [https://studio.ai.gloo.com/api-keys](https://studio.ai.gloo.com/api-keys).

## Running the Example

**Basic usage:**
```bash
go run main.go
```

**Build and run:**
```bash
go build -o chat-tutorial
./chat-tutorial
```

**With Go modules:**
```bash
go mod download
go run .
```

## Expected Output

The example will:
1. Validate environment variables
2. Authenticate with the Gloo AI API using your API key
3. Ask a deep question about finding meaning and purpose
4. Follow up with practical questions
5. Display the complete conversation history with formatted timestamps

## Code Structure

The example demonstrates idiomatic Go patterns:

### Data Structures
```go
type MessageResponse struct {
    QueryID   string `json:"query_id"`
    MessageID string `json:"message_id"`
    Message   string `json:"message"`
    Timestamp string `json:"timestamp"`
}
```

### Functions
- `sendMessage()` - Sends messages to the chat API
- `getChatHistory()` - Retrieves conversation history
- `validateEnvironment()` - Validates required environment variables
- `displayMessage()` - Formats message display with timestamps
- `main()` - Demonstrates the complete flow

## Error Handling

The example includes comprehensive error handling:

### Custom Error Type
```go
type GlooApiError struct {
    Message    string
    StatusCode int
}

func (e *GlooApiError) Error() string {
    return e.Message
}
```

### Error Types Handled
- Authentication failures
- API rate limits and network issues
- Invalid responses and timeouts
- Environment configuration errors
- JSON marshaling/unmarshaling errors

## Dependencies

The example uses minimal, high-quality dependencies:

- **godotenv**: For environment variable management from .env files
- **Standard library**: All HTTP and JSON handling uses Go's standard library

## API Endpoints Used

- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Go Features Used

- **Structs with JSON tags**: Clean data structure definitions
- **Error handling**: Proper Go error handling patterns
- **HTTP client**: Standard library HTTP client with timeouts
- **JSON marshaling**: Built-in JSON encoding/decoding
- **Time handling**: Proper timestamp parsing and formatting
- **Environment variables**: Secure configuration management
- **Goroutines**: (Not used in this example, but easily extendable)

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers
- Extending the structs for additional functionality

## Building and Distribution

**Build for current platform:**
```bash
go build -o chat-tutorial
```

**Build for different platforms:**
```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o chat-tutorial-linux

# Windows
GOOS=windows GOARCH=amd64 go build -o chat-tutorial.exe

# macOS
GOOS=darwin GOARCH=amd64 go build -o chat-tutorial-macos
```

**With optimizations:**
```bash
go build -ldflags="-s -w" -o chat-tutorial
```

## Development

The code follows Go best practices:
- Proper package structure
- Idiomatic error handling
- Clear function signatures
- Appropriate use of pointers
- Consistent naming conventions
- Proper use of Go modules

## Testing

To add tests, create a `main_test.go` file:

```go
package main

import (
    "testing"
)

func TestValidateEnvironment(t *testing.T) {
    // Test environment validation logic
    apiKey = ""
    if err := validateEnvironment(); err == nil {
        t.Error("Expected error for empty API key")
    }
}
```

Run tests:
```bash
go test
```

## Troubleshooting

**Common issues:**

1. **"Please set your GLOO_API_KEY"** - Ensure your API key environment variable is set
2. **Go version errors** - Ensure Go 1.21+ is installed
3. **Module errors** - Run `go mod tidy` to clean up dependencies
4. **Network errors** - Check your internet connection
5. **401 Unauthorized** - Verify your API key is correct
6. **Build errors** - Ensure all dependencies are installed

**Debugging:**
```bash
# Check Go version
go version

# Verify module status
go mod verify

# Run with verbose output
go run -v main.go

# Check environment variables
go env
```

## Learn More

- [Go Documentation](https://golang.org/doc/)
- [Go Modules](https://blog.golang.org/using-go-modules)
- [Effective Go](https://golang.org/doc/effective_go.html)
- [Go HTTP Client](https://golang.org/pkg/net/http/)
- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)
