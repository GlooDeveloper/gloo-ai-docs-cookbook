# Gloo AI Authentication Tutorial - Java

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in Java.

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
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them directly:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

3. **Get your API key:**
   
   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

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
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
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

1. Verifying API key is configured...
   API key is set

2. Testing authenticated API call...
   API call successful
   Response: Hello! I'm ready when you are. How can I help you today?...

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
            // Make authenticated API calls
            ChatCompletionRequest request = new ChatCompletionRequest(
                true,
                List.of(new ChatMessage("user", "Your message here"))
            );

            ChatCompletionResponse result = AuthTutorial.makeAuthenticatedRequest(
                "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions",
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
// API request/response models
public static class ChatMessage {
    public String role;
    public String content;
}

public static class ChatCompletionRequest {
    public boolean auto_routing;
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
- Network connectivity issues
- API errors

All exceptions are properly caught and handled with meaningful error messages.

## Security Features

- Environment variable management
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

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Build errors**: Run `mvn clean compile` to resolve dependencies
- **Java version**: Ensure you have Java 17 or higher installed
- **Maven errors**: Check your Maven installation and version
