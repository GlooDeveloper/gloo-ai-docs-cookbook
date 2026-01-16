# Gloo AI Completions Tutorial - Go

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint in Go.

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
go build -o completions-tutorial
./completions-tutorial
```

This will run multiple completion tests that:
1. Authenticate with the Gloo AI API
2. Make completion requests for different prompts
3. Display the generated responses

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling with proper Go error wrapping
- **Environment Variables**: Secure credential management using godotenv
- **Multiple Tests**: Tests multiple completion scenarios
- **Go Best Practices**: Proper error handling, context usage, and structured types

## Dependencies

- `github.com/joho/godotenv`: Environment variable management

## Expected Output

```
=== Gloo AI Completions API Test ===

Test 1: How can I be joyful in hard times?
   ✓ Completion successful
   Response: Finding joy during difficult times is a deeply human challenge that many people face...

Test 2: What are the benefits of a positive mindset?
   ✓ Completion successful
   Response: A positive mindset can have profound effects on both mental and physical well-being...

Test 3: How do I build meaningful relationships?
   ✓ Completion successful
   Response: Building meaningful relationships requires intentionality, authenticity, and consistent effort...

=== All completion tests passed! ===
```

## Usage in Your Application

```go
package main

import (
    "fmt"
    "log"
)

func example() {
    // Make a completion request
    completion, err := makeChatCompletionRequest("Your prompt here")
    if err != nil {
        log.Fatalf("Failed to make completion request: %v", err)
    }
    
    // Extract the response
    response := completion.Choices[0].Message.Content
    fmt.Println(response)
    
    // Or get a token for other API calls
    token, err := ensureValidToken()
    if err != nil {
        log.Fatalf("Failed to get token: %v", err)
    }
    
    // Use token for other authenticated requests
    fmt.Println("Token:", token)
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

## Authentication

This example uses the authentication methods from the [Authentication Tutorial](../../../tutorials/authentication). The token management is handled automatically, but you can also use the `ensureValidToken()` function to get a token for other API calls.

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
go build -o completions-tutorial main.go
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