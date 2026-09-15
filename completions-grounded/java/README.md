# Grounded Completions Recipe - Java

This Java implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- Java 11 or higher
- Maven 3.6 or higher
- Gloo AI account with API key
- Publisher created in [Gloo Studio](https://studio.ai.gloo.com) with content uploaded

## Setup

1. **Install dependencies**:
   ```bash
   mvn clean install
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
mvn exec:java
```

Or build and run the JAR:
```bash
mvn package
java -jar target/grounded-completions-recipe-1.0.0-jar-with-dependencies.jar
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## Project Structure

```
src/main/java/com/gloo/grounded/
└── GroundedCompletionsRecipe.java  # Main application class
```

## How It Works

### Authentication
```java
// API key is read from environment and used directly as Bearer token
glooApiKey = dotenv.get("GLOO_API_KEY");
request.header("Authorization", "Bearer " + glooApiKey);
```

### Non-Grounded Request
```java
private static JsonObject makeNonGroundedRequest(String query) throws Exception {
    // Standard completion WITHOUT RAG
    JsonObject payload = new JsonObject();
    payload.add("messages", messages);
    payload.addProperty("auto_routing", true);
    payload.addProperty("max_tokens", 500);
    // POST to /ai/v2/guarded/chat/completions
}
```

### Grounded Request
```java
private static JsonObject makeGroundedRequest(
    String query,
    String publisherName,
    int sourcesLimit
) throws Exception {
    // Grounded completion WITH RAG
    JsonObject payload = new JsonObject();
    payload.add("messages", messages);
    payload.addProperty("auto_routing", true);
    payload.addProperty("rag_publisher", publisherName);
    payload.addProperty("sources_limit", sourcesLimit);
    payload.addProperty("max_tokens", 500);
    // POST to /ai/v2/grounded/chat/completions
}
```

### Side-by-Side Comparison
```java
private static void compareResponses(String query, String publisherName) {
    // Compare both approaches for the same query
}
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```java
// Use more sources for complex queries
JsonObject grounded = makeGroundedRequest(query, publisherName, 5);
```

### Add Custom Queries

```java
public static void main(String[] args) {
    String[] queries = {
        "Your custom question here",
        "Another question about your content"
    };

    for (String query : queries) {
        compareResponses(query, publisherName);
    }
}
```

### Use as a Library

```java
import com.gloo.grounded.GroundedCompletionsRecipe;

public class MyApplication {
    public static void main(String[] args) throws Exception {
        JsonObject result = GroundedCompletionsRecipe.makeGroundedRequest(
            "Your query",
            "YourPublisher",
            3
        );

        String content = result.getAsJsonArray("choices")
            .get(0).getAsJsonObject()
            .getAsJsonObject("message")
            .get("content").getAsString();

        System.out.println(content);
    }
}
```

## Troubleshooting

### Maven Dependency Errors
```bash
mvn clean install -U
```

### Compilation Errors
Ensure you have Java 11 or higher:
```bash
java -version
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

### SSL/TLS Errors
If you encounter SSL errors, ensure your Java installation has up-to-date CA certificates:
```bash
# Update Java cacerts if needed
keytool -list -keystore $JAVA_HOME/lib/security/cacerts
```

## Maven Commands

```bash
# Clean and compile
mvn clean compile

# Run tests (if any)
mvn test

# Package into JAR
mvn package

# Run directly
mvn exec:java

# Clean everything
mvn clean
```

## Learn More

- [Grounded Completions Recipe](https://docs.ai.gloo.com/tutorials/grounded-completions-recipe) - Full tutorial
- [Completions V2 API Guide](https://docs.ai.gloo.com/api-guides/completions-v2) - API documentation
- [Upload Content Tutorial](https://docs.ai.gloo.com/tutorials/upload-content) - Setting up Publishers
