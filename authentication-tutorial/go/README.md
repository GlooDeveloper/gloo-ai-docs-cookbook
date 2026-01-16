# Gloo AI Authentication Tutorial - Go

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in Go.

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
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

   Or export them directly:
   ```bash
   export GLOO_CLIENT_ID="your_client_id_here"
   export GLOO_CLIENT_SECRET="your_client_secret_here"
   ```

3. **Get your credentials:**
   
   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

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
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling with proper Go error wrapping
- **Environment Variables**: Secure credential management using godotenv
- **Test Suite**: Built-in tests to verify authentication setup
- **Go Best Practices**: Proper error handling, context usage, and structured types

## Dependencies

- `github.com/joho/godotenv`: Environment variable management

## Expected Output

```
=== Gloo AI Authentication Test ===

1. Testing token retrieval...
   ✓ Token retrieved successfully
   Token type: Bearer
   Expires in: 3600 seconds

2. Testing token validation...
   ✓ Token validation successful

3. Testing authenticated API call...
   ✓ API call successful
   Response: Hello! I'm Claude, an AI assistant created by Anthropic...

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
    // Get a valid token
    token, err := ensureValidToken()
    if err != nil {
        log.Fatalf("Failed to get token: %v", err)
    }
    
    // Make authenticated API calls
    request := ChatCompletionRequest{
        Model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        Messages: []ChatMessage{
            {Role: "user", Content: "Your message here"},
        },
    }
    
    result, err := makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v1/chat/completions",
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
type TokenInfo struct {
    AccessToken string `json:"access_token"`
    ExpiresIn   int    `json:"expires_in"`
    ExpiresAt   int64  `json:"expires_at"`
    TokenType   string `json:"token_type"`
}

type ChatMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type ChatCompletionRequest struct {
    Model    string        `json:"model"`
    Messages []ChatMessage `json:"messages"`
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
- Token expiration
- Network connectivity issues
- API errors

All errors are properly wrapped using Go's error wrapping functionality.

## Security Features

- Environment variable management
- Secure token storage
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

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module errors**: Run `go mod tidy` to resolve dependencies
- **Build errors**: Ensure you have Go 1.20 or higher installed