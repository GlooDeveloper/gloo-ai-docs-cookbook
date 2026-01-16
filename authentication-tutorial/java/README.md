# Gloo AI Authentication Tutorial - Java

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in Java.

## Requirements

- Java 17 or higher
- Maven 3.6 or higher

## Setup

1. **Build the project:**
   ```bash
   mvn clean compile
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

Using Maven:
```bash
mvn exec:java
```

Or compile and run directly:
```bash
mvn clean package
java -cp target/classes:target/dependency/* com.gloo.auth.AuthTutorial
```

This will run a complete authentication test that:
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling with proper Java exceptions
- **Environment Variables**: Secure credential management using java-dotenv
- **Test Suite**: Built-in tests to verify authentication setup
- **Java Best Practices**: Modern Java features, proper exception handling, and clean code

## Dependencies

- `com.google.code.gson:gson`: JSON parsing
- `io.github.cdimascio:java-dotenv`: Environment variable management

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

```java
import com.gloo.auth.AuthTutorial;
import com.gloo.auth.AuthTutorial.ChatCompletionRequest;
import com.gloo.auth.AuthTutorial.ChatCompletionResponse;
import com.gloo.auth.AuthTutorial.ChatMessage;
import java.util.List;

public class Example {
    public static void main(String[] args) {
        try {
            // Get a valid token
            String token = AuthTutorial.ensureValidToken();
            
            // Make authenticated API calls
            ChatCompletionRequest request = new ChatCompletionRequest(
                "us.anthropic.claude-sonnet-4-20250514-v1:0",
                List.of(new ChatMessage("user", "Your message here"))
            );
            
            ChatCompletionResponse result = AuthTutorial.makeAuthenticatedRequest(
                "https://platform.ai.gloo.com/ai/v1/chat/completions",
                request
            );
            
            System.out.println(result.choices.get(0).message.content);
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

## Class Structure

The example includes well-structured classes:

```java
// Token management
public static class TokenInfo {
    public String access_token;
    public int expires_in;
    public long expires_at;
    public String token_type;
}

// API request/response models
public static class ChatMessage {
    public String role;
    public String content;
}

public static class ChatCompletionRequest {
    public String model;
    public List<ChatMessage> messages;
}

public static class ChatCompletionResponse {
    public List<Choice> choices;
    // ... nested classes
}
```

## Error Handling

The example includes comprehensive error handling for:
- HTTP request failures
- JSON parsing errors
- Token expiration
- Network connectivity issues
- API errors

All exceptions are properly caught and handled with meaningful error messages.

## Security Features

- Environment variable management
- Secure token storage
- Proper error handling without exposing sensitive information
- Input validation
- Request timeouts

## Building

To build the project:
```bash
mvn clean package
```

This creates a JAR file in the `target/` directory.

## Testing

To run the built-in tests:
```bash
mvn exec:java
```

## Maven Configuration

The project uses:
- Java 17 target
- Maven Compiler Plugin 3.11.0
- Maven Exec Plugin 3.1.0
- Gson 2.10.1 for JSON processing
- java-dotenv 5.2.2 for environment variables

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Build errors**: Run `mvn clean compile` to resolve dependencies
- **Java version**: Ensure you have Java 17 or higher installed
- **Maven errors**: Check your Maven installation and version