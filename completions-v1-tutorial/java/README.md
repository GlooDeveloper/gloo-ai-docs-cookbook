# Gloo AI Completions Tutorial - Java

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint in Java.

## Requirements

- Java 17 or higher
- Maven 3.6 or higher

## Setup

1. **Install dependencies:**
   ```bash
   mvn clean install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```bash
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

   Or set them as system environment variables:
   ```bash
   export GLOO_CLIENT_ID="your_client_id_here"
   export GLOO_CLIENT_SECRET="your_client_secret_here"
   ```

3. **Get your credentials:**
   
   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
mvn exec:java
```

Or compile and run manually:
```bash
mvn compile exec:java -Dexec.mainClass="com.gloo.completions.CompletionsTutorial"
```

This will run multiple completion tests that:
1. Authenticate with the Gloo AI API using OAuth2 client credentials
2. Make completion requests for different prompts
3. Display the generated responses

## Key Features

- **Token Management**: Automatic token refresh with expiration handling
- **Error Handling**: Comprehensive exception handling with detailed error messages
- **Environment Variables**: Secure credential management using java-dotenv
- **Multiple Tests**: Tests multiple completion scenarios with different prompts
- **Type Safety**: Full type definitions for all API requests and responses
- **Maven Integration**: Easy dependency management and build process

## Dependencies

- `com.google.code.gson:gson:2.10.1`: JSON parsing and serialization
- `io.github.cdimascio:java-dotenv:5.2.2`: Environment variable management

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

```java
import com.gloo.completions.CompletionsTutorial;
import com.gloo.completions.CompletionsTutorial.ChatCompletionResponse;

public class Example {
    public static void main(String[] args) {
        try {
            // Make a completion request
            ChatCompletionResponse completion = CompletionsTutorial.makeChatCompletionRequest("Your prompt here");
            
            // Extract the response
            String response = completion.choices.get(0).message.content;
            System.out.println(response);
            
            // Or get a token for other API calls
            String token = CompletionsTutorial.ensureValidToken();
            System.out.println("Token: " + token);
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}
```

## Type Safety

The example includes comprehensive type definitions for all API interactions:

```java
public static class TokenInfo {
    public String access_token;
    public int expires_in;
    public long expires_at;
    public String token_type;
}

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
    
    public static class Choice {
        public Message message;
        
        public static class Message {
            public String role;
            public String content;
        }
    }
}
```

## Authentication

This example uses the authentication methods from the [Authentication Tutorial](../../../tutorials/authentication). The token management is handled automatically, but you can also use the `ensureValidToken()` method to get a token for other API calls.

## Error Handling

The example includes comprehensive error handling for:
- HTTP request failures
- JSON parsing errors
- Token expiration and refresh
- Network connectivity issues
- API authentication errors
- Invalid response formats

All errors are wrapped in Java exceptions with detailed error messages.

## Security Features

- Environment variable management with java-dotenv
- Secure token storage with automatic refresh
- Proper error handling without exposing sensitive information
- Input validation and sanitization
- Request timeouts (30 seconds)
- Base64 encoding for authentication headers

## Building

To build a JAR file:
```bash
mvn clean package
```

To run the built JAR:
```bash
java -jar target/completions-tutorial-1.0.0.jar
```

## Maven Commands

- `mvn clean`: Clean build artifacts
- `mvn compile`: Compile source code
- `mvn package`: Create JAR file
- `mvn exec:java`: Run the application
- `mvn dependency:tree`: Show dependency tree

## Testing

To run the built-in tests:
```bash
mvn exec:java
```

## IDE Setup

### IntelliJ IDEA
1. Open the project directory
2. IntelliJ will automatically detect the Maven project
3. Run the main class: `com.gloo.completions.CompletionsTutorial`

### Eclipse
1. Import as Maven project
2. Right-click on the project → Run As → Java Application
3. Select `CompletionsTutorial` as the main class

### VS Code
1. Install Java Extension Pack
2. Open the project directory
3. Use Ctrl+Shift+P → "Java: Run"

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret in the .env file
- **403 Forbidden**: Verify your API access permissions in the Gloo AI Studio
- **Network errors**: Ensure you have internet connectivity and the API endpoints are accessible
- **Maven errors**: Run `mvn clean install` to resolve dependencies
- **Java version**: Ensure you have Java 17 or higher installed (`java --version`)
- **Build errors**: Check that Maven is properly installed (`mvn --version`)
- **ClassNotFoundException**: Ensure the project is properly compiled with `mvn compile`

## Project Structure

```
java/
├── src/
│   └── main/
│       └── java/
│           └── com/
│               └── gloo/
│                   └── completions/
│                       └── CompletionsTutorial.java
├── pom.xml
├── README.md
└── .env (create this file)
```

## Advanced Usage

### Custom HTTP Client Configuration

```java
private static final HttpClient httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(30))
    .followRedirects(HttpClient.Redirect.NORMAL)
    .build();
```

### Custom Request Parameters

```java
ChatCompletionRequest request = new ChatCompletionRequest(
    "us.anthropic.claude-sonnet-4-20250514-v1:0",
    List.of(
        new ChatMessage("system", "You are a helpful assistant."),
        new ChatMessage("user", "Your question here")
    )
);
```

### Async Processing

```java
CompletableFuture<ChatCompletionResponse> future = CompletableFuture.supplyAsync(() -> {
    try {
        return makeChatCompletionRequest("Your prompt");
    } catch (Exception e) {
        throw new RuntimeException(e);
    }
});

future.thenAccept(response -> {
    System.out.println(response.choices.get(0).message.content);
});
```