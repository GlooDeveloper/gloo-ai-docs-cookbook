# Gloo AI Chat Message Tutorial - Java

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using Java with modern Java features and best practices.

## Features

- ✅ OAuth2 authentication with automatic token refresh
- ✅ Modern Java 17+ features (records, text blocks, pattern matching)
- ✅ Maven-based project structure
- ✅ Create new chat sessions
- ✅ Continue conversations with context
- ✅ Retrieve and display chat history
- ✅ Comprehensive error handling with custom exceptions
- ✅ Environment validation and configuration
- ✅ Formatted timestamp display
- ✅ Human flourishing conversation examples

## Prerequisites

- Java 17 or higher
- Maven 3.6 or higher
- Gloo AI API credentials (Client ID and Client Secret)

## Setup

1. **Verify Java and Maven:**
   ```bash
   java --version
   mvn --version
   ```

2. **Install dependencies:**
   ```bash
   mvn clean install
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```env
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

   Or export them in your shell:
   ```bash
   export GLOO_CLIENT_ID="your_client_id_here"
   export GLOO_CLIENT_SECRET="your_client_secret_here"
   ```

## Running the Example

**Using Maven exec plugin:**
```bash
mvn exec:java
```

**Compile and run manually:**
```bash
mvn compile
mvn exec:java -Dexec.mainClass="com.gloo.ai.ChatTutorial"
```

**Create and run JAR:**
```bash
mvn package
java -jar target/chat-message-tutorial-1.0.0.jar
```

**Run with specific JVM options:**
```bash
java -Xmx512m -jar target/chat-message-tutorial-1.0.0.jar
```

## Expected Output

The example will:
1. Validate environment variables
2. Authenticate with the Gloo AI API
3. Ask a deep question about finding meaning and purpose
4. Follow up with practical questions
5. Display the complete conversation history with formatted timestamps

## Code Structure

The example demonstrates modern Java patterns:

### Data Classes
```java
public static class TokenInfo {
    @SerializedName("access_token")
    public String accessToken;
    
    @SerializedName("expires_in")
    public int expiresIn;
    
    @SerializedName("expires_at")
    public long expiresAt;
    
    @SerializedName("token_type")
    public String tokenType;
}
```

### Methods
- `getAccessToken()` - Handles OAuth2 authentication
- `sendMessage()` - Sends messages to the chat API
- `getChatHistory()` - Retrieves conversation history
- `validateEnvironment()` - Validates required environment variables
- `displayMessage()` - Formats message display with timestamps
- `runExample()` - Demonstrates the complete flow

## Error Handling

The example includes comprehensive error handling:

### Custom Exception
```java
public static class GlooApiException extends Exception {
    public final int statusCode;
    
    public GlooApiException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
```

### Error Types Handled
- Authentication failures
- API rate limits and network issues
- Invalid responses and timeouts
- Environment configuration errors
- JSON parsing errors
- Thread interruption

## Dependencies

The example uses minimal, high-quality dependencies:

- **Gson**: For JSON serialization/deserialization
- **JUnit 5**: For testing (dev dependency)
- **Java HTTP Client**: Built-in HTTP client (Java 11+)

## API Endpoints Used

- `POST /oauth2/token` - Authentication
- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Java Features Used

- **Java 17+**: Modern syntax and features
- **HTTP Client**: Built-in Java HTTP client with timeout support
- **Gson Annotations**: Clean JSON serialization
- **Exception Handling**: Proper Java exception patterns
- **Static Inner Classes**: Clean code organization
- **Duration API**: Modern time handling
- **Collections**: Immutable lists and modern collection operations

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers
- Extending the classes for additional functionality

## Maven Commands

**Common development commands:**
```bash
# Clean and compile
mvn clean compile

# Run tests
mvn test

# Package JAR
mvn package

# Run with exec plugin
mvn exec:java

# Install to local repository
mvn install

# Generate project documentation
mvn site
```

## Development Best Practices

The code follows Java best practices:
- Clear package structure
- Proper exception handling
- Immutable data where possible
- Meaningful variable and method names
- Comprehensive JavaDoc (can be added)
- Proper resource management
- Modern Java features usage

## Testing

To add unit tests, create test classes in `src/test/java/`:

```java
package com.gloo.ai;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

public class ChatTutorialTest {
    
    private ChatTutorial tutorial;
    
    @BeforeEach
    void setUp() {
        tutorial = new ChatTutorial();
    }
    
    @Test
    void testTokenExpiration() {
        // Test token expiration logic
        assertTrue(tutorial.isTokenExpired(null));
    }
}
```

Run tests:
```bash
mvn test
```

## Building for Distribution

**Create executable JAR:**
```bash
mvn clean package
```

**Create JAR with dependencies:**
```bash
mvn clean package -DskipTests
```

**Build for different environments:**
```bash
# Development build
mvn clean compile

# Production build
mvn clean package -Dmaven.test.skip=true
```

## IDE Integration

**IntelliJ IDEA:**
- Import as Maven project
- Set Project SDK to Java 17+
- Enable annotation processing for Gson

**Eclipse:**
- Import as Existing Maven Project
- Set Java Build Path to Java 17+
- Install Maven integration plugins

**VS Code:**
- Install Java Extension Pack
- Open folder containing pom.xml
- Use Command Palette for Maven commands

## Troubleshooting

**Common issues:**

1. **"Please set your credentials"** - Ensure environment variables are set
2. **Java version errors** - Ensure Java 17+ is installed and configured
3. **Maven errors** - Run `mvn clean install` to resolve dependencies
4. **Network errors** - Check internet connection and proxy settings
5. **401 Unauthorized** - Verify your credentials are correct
6. **OutOfMemoryError** - Increase JVM heap size with `-Xmx` flag

**Debugging:**
```bash
# Check Java version
java --version

# Verify Maven configuration
mvn -version

# Run with verbose output
mvn exec:java -X

# Check dependencies
mvn dependency:tree
```

## Performance Optimization

**JVM Tuning:**
```bash
# Optimize for startup time
java -XX:+UseSerialGC -Xms64m -Xmx256m -jar target/chat-message-tutorial-1.0.0.jar

# Optimize for throughput
java -XX:+UseG1GC -Xms512m -Xmx1g -jar target/chat-message-tutorial-1.0.0.jar
```

## Learn More

- [Java Documentation](https://docs.oracle.com/en/java/javase/17/)
- [Maven Documentation](https://maven.apache.org/guides/)
- [Gson Documentation](https://github.com/google/gson)
- [Java HTTP Client](https://openjdk.java.net/groups/net/httpclient/intro.html)
- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)