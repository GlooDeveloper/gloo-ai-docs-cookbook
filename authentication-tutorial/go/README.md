# Gloo AI Authentication Tutorial - Go

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in Go.

## Requirements

- Go 1.20 or higher

## Setup

1. **Initialize Go module and install dependencies:**
   ```bash
   go mod tidy
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```bash
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them directly:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

3. **Get your API key:**
   
   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Running the Example

```bash
go run main.go
```

Or build and run:
```bash
go build -o auth-tutorial
./auth-tutorial
```

This will run a complete authentication test that:
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
- **Error Handling**: Comprehensive error handling with proper Go error wrapping
- **Environment Variables**: Secure credential management using godotenv
- **Test Suite**: Built-in tests to verify authentication setup
- **Go Best Practices**: Proper error handling, context usage, and structured types

## Dependencies

- `github.com/joho/godotenv`: Environment variable management

## Expected Output

```
=== Gloo AI Authentication Test ===

1. Verifying API key is configured...
   API key is set

2. Testing authenticated API call...
   API call successful
   Response: Hello! I'm ready when you are. How can I help you today?...

=== All tests passed! ===
```

## Usage in Your Application

```go
package main

import (
    "fmt"
    "log"
)

func example() {
    // Make authenticated API calls
    request := ChatCompletionRequest{
        AutoRouting: true,
        Messages: []ChatMessage{
            {Role: "user", Content: "Your message here"},
        },
    }

    result, err := makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v2/chat/completions",
        request,
    )
    if err != nil {
        log.Fatalf("API call failed: %v", err)
    }
    
    fmt.Println(result.Choices[0].Message.Content)
}
```

## Type Safety

The example includes comprehensive type definitions:

```go
type ChatMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type ChatCompletionRequest struct {
    AutoRouting bool          `json:"auto_routing"`
    Messages    []ChatMessage `json:"messages"`
}

type ChatCompletionResponse struct {
    Choices []struct {
        Message struct {
            Role    string `json:"role"`
            Content string `json:"content"`
        } `json:"message"`
    } `json:"choices"`
}
```

## Error Handling

The example includes comprehensive error handling for:
- HTTP request failures
- JSON parsing errors
- Network connectivity issues
- API errors

All errors are properly wrapped using Go's error wrapping functionality.

## Security Features

- Environment variable management
- Proper error handling without exposing sensitive information
- Input validation
- Request timeouts

## Building

To build a standalone binary:
```bash
go build -o auth-tutorial main.go
```

## Testing

To run the built-in tests:
```bash
go run main.go
```

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module errors**: Run `go mod tidy` to resolve dependencies
- **Build errors**: Ensure you have Go 1.20 or higher installed
