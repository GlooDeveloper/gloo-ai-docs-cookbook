# Realtime Ingestion - Java Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with Java to automatically upload content and make it available for search and AI interaction.

## Features

- **Modern Java**: Uses Java 17+ with modern language features and patterns
- **Clean Architecture**: Well-structured object-oriented design with separate classes for token management, content processing, and file monitoring
- **Environment-based Authentication**: Secure credential management using .env files with dotenv-java
- **HTTP Client**: OkHttp3 for robust, efficient HTTP communication with connection pooling
- **File System Monitoring**: Real-time file watching using `directory-watcher` library for cross-platform compatibility
- **Batch Processing**: Upload multiple files at once with configurable rate limiting
- **Single File Upload**: Process individual files on demand
- **Comprehensive Error Handling**: Proper exception handling with detailed logging using SLF4J/Logback
- **Token Management**: Automatic token refresh with proper lifecycle management
- **Maven Integration**: Modern Maven setup with profiles and plugins for easy building and execution
- **Production Ready**: Robust error handling, logging, monitoring, and resource management
- **Concurrent Safe**: Thread-safe design suitable for concurrent operations

## Prerequisites

- Java 17+ installed (JDK recommended)
- Maven 3.6+ installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Build the project and install dependencies:
```bash
mvn clean compile
```

2. Create a `.env` file in the project root directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

3. Update the `PUBLISHER_ID` constant in `RealtimeIngestionApp.java` with your actual publisher ID.

## Usage

### Maven Execution (Recommended)

#### Single File Upload
Upload a single file to the Realtime API:
```bash
mvn exec:java -Dexec.args="single ./sample_content/developer_happiness.txt"
```

#### Directory Monitoring
Monitor a directory for new files and automatically upload them:
```bash
mvn exec:java -Dexec.args="watch ./sample_content"
```

#### Batch Processing
Process all supported files in a directory at once:
```bash
mvn exec:java -Dexec.args="batch ./sample_content"
```

### Using Maven Profiles (Shortcuts)
Convenient profiles are pre-configured in `pom.xml`:
```bash
mvn exec:java -Psingle    # Process sample article
mvn exec:java -Pbatch     # Process all files in sample_content directory
mvn exec:java -Pwatch     # Monitor sample_content directory
```

### JAR Execution
Build and run as a standalone JAR:
```bash
# Build fat JAR
mvn clean package

# Run commands
java -jar target/realtime-ingestion-1.0.0.jar single ./sample_content/article.txt
java -jar target/realtime-ingestion-1.0.0.jar batch ./sample_content
java -jar target/realtime-ingestion-1.0.0.jar watch ./sample_content
```

## Architecture

The Java implementation follows enterprise-grade patterns with clear separation of concerns:

### TokenManager Class
Handles OAuth2 token lifecycle with enterprise patterns:
- `getValidToken()`: Returns valid token, refreshing automatically if needed
- `fetchAccessToken()`: Retrieves new tokens with proper error handling
- `isTokenExpired()`: Checks expiration with 60-second buffer
- Uses OkHttp3 with connection pooling and timeout configuration
- Proper credential validation and error reporting

### ContentProcessor Class
Manages content processing and uploads:
- `processFile()`: Complete file processing pipeline with comprehensive validation
- `uploadContent()`: API communication with structured error handling
- `createContentData()`: Content metadata generation with proper object mapping
- `extractTitleFromFilename()`: Smart title extraction and formatting
- `isSupportedFile()`: Efficient file type validation using Set lookup
- Comprehensive logging with SLF4J

### BatchProcessor Class
Handles bulk file processing:
- `processDirectory()`: Bulk file processing with filesystem walking
- `findSupportedFiles()`: Efficient file discovery using Java Streams
- Statistics tracking for processed and failed files
- Rate limiting with configurable delays
- Progress reporting and error aggregation

### FileWatcher Class
Handles real-time file system monitoring:
- `watch()`: Directory monitoring using `directory-watcher` library
- `handleDirectoryChange()`: Event-driven file processing
- Cross-platform file system event handling
- Graceful shutdown with proper resource cleanup
- Thread-safe event processing

### Main Application Class
Application controller with dependency injection and lifecycle management:
- Clean initialization and dependency management
- Command-line argument parsing and validation
- Centralized error handling and logging
- Graceful resource cleanup and shutdown hooks

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

File types are efficiently validated using Set-based lookup for O(1) performance.

## Example Content

Create a sample file to test:
```bash
mkdir sample_content
cat > sample_content/sample_article.txt << 'EOF'
This is a sample article about content ingestion using the Gloo AI Realtime API.

The Java implementation provides excellent performance, robust error handling, 
enterprise-grade patterns, and comprehensive logging capabilities.
EOF
```

Then run:
```bash
mvn exec:java -Psingle
```

## Configuration

### Environment Variables (.env file)
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

### Constants (modify in RealtimeIngestionApp.java)
- `PUBLISHER_ID`: Your publisher UUID (required)
- `API_URL`: Realtime ingestion endpoint
- `TOKEN_URL`: OAuth2 token endpoint
- `SUPPORTED_EXTENSIONS`: Set of supported file extensions
- `API_TIMEOUT`: HTTP request timeout duration
- `RATE_LIMIT_DELAY`: Delay between API calls

## Content Metadata

The system automatically extracts and sets metadata using proper Java objects:
- **Title**: Derived from filename with proper case conversion
- **Author**: String array with "Automated Ingestion"
- **Publication Date**: Current date in ISO format
- **Type**: "Article"
- **Tags**: String array ["automated", "ingestion"]
- **Content Type**: "technical"
- **DRM**: String array ["aspen", "kallm"]
- **Evergreen**: Boolean true

## Error Handling

The Java implementation uses enterprise-grade error handling patterns:

### Exception Handling
- Proper exception chaining and context preservation
- Detailed error messages with specific failure reasons
- Structured logging with correlation IDs
- Graceful degradation and recovery strategies

### Logging
Uses SLF4J with Logback for comprehensive logging:
```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    <root level="INFO">
        <appender-ref ref="STDOUT" />
    </root>
</configuration>
```

## Dependencies

The project uses mature, well-maintained libraries:

### OkHttp3 (4.12.0)
- High-performance HTTP client with connection pooling
- Built-in retry logic and transparent compression
- WebSocket support and HTTP/2 compatibility
- Comprehensive request/response interceptors

### Gson (2.10.1)
- Fast, efficient JSON serialization/deserialization
- Type-safe JSON handling with generics
- Custom serialization adapters support
- Memory-efficient streaming API

### dotenv-java (3.0.0)
- Secure environment variable management
- .env file parsing and loading
- Production-safe configuration handling
- Variable substitution and validation

### directory-watcher (0.18.0)
- Cross-platform directory monitoring
- Native file system event handling
- Efficient event filtering and processing
- Recursive directory watching support

### SLF4J + Logback
- Industry-standard logging framework
- Structured logging with multiple appenders
- Configuration flexibility with XML/properties
- Performance optimized with async logging

## Development

### Code Quality
The code follows Java best practices:
- Clean Code principles with meaningful names
- SOLID design principles
- Proper encapsulation and abstraction
- Comprehensive JavaDoc documentation
- Consistent formatting and style

### Maven Configuration
Modern Maven setup with:
- Java 17 source/target compatibility
- Dependency management with version properties
- Plugin configuration for building and execution
- Profiles for different execution modes
- Shade plugin for fat JAR creation

### Testing Setup
JUnit 5 integration ready:
```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

class ContentProcessorTest {
    
    private ContentProcessor processor;
    
    @BeforeEach
    void setUp() {
        processor = new ContentProcessor();
    }
    
    @Test
    void testExtractTitleFromFilename() {
        String title = processor.extractTitleFromFilename("hello_world.txt");
        assertEquals("Hello World", title);
    }
}
```

## Building and Deployment

### Development Build
```bash
# Compile and run tests
mvn clean test

# Package without tests (faster)
mvn clean package -DskipTests

# Clean install with all phases
mvn clean install
```

### Production Build
```bash
# Create optimized fat JAR
mvn clean package -Dmaven.test.skip=true

# Verify JAR contents
jar tf target/realtime-ingestion-1.0.0.jar | head -20

# Test JAR execution
java -jar target/realtime-ingestion-1.0.0.jar --help
```

### Docker Deployment
```dockerfile
FROM openjdk:17-jdk-slim

WORKDIR /app

# Copy Maven files for dependency caching
COPY pom.xml ./
RUN mvn dependency:go-offline

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:17-jre-slim
WORKDIR /app
COPY --from=0 /app/target/realtime-ingestion-1.0.0.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
CMD ["watch", "/content"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: realtime-ingestion
spec:
  replicas: 1
  selector:
    matchLabels:
      app: realtime-ingestion
  template:
    metadata:
      labels:
        app: realtime-ingestion
    spec:
      containers:
      - name: app
        image: gloo-ai/realtime-ingestion:latest
        env:
        - name: GLOO_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: gloo-credentials
              key: client-id
        - name: GLOO_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: gloo-credentials
              key: client-secret
        volumeMounts:
        - name: content-volume
          mountPath: /content
      volumes:
      - name: content-volume
        persistentVolumeClaim:
          claimName: content-pvc
```

## Performance Optimization

### JVM Tuning
For production deployments:
```bash
java -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -Xms512m -Xmx2g \
     -XX:+HeapDumpOnOutOfMemoryError \
     -jar target/realtime-ingestion-1.0.0.jar watch /content
```

### HTTP Client Optimization
OkHttp3 configuration in TokenManager:
```java
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .connectionPool(new ConnectionPool(5, 5, TimeUnit.MINUTES))
    .retryOnConnectionFailure(true)
    .build();
```

### Memory Management
- Stream-based file processing for large files
- Proper resource cleanup with try-with-resources
- Connection pooling for HTTP clients
- Efficient JSON processing with Gson

## Monitoring and Observability

### Application Metrics
Integrate with Micrometer for metrics:
```java
// Add to pom.xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
    <version>1.12.0</version>
</dependency>

// In application code
Counter.Sample sample = Timer.start(Metrics.globalRegistry);
// ... process file
sample.stop(Timer.builder("file.processing.time").register(Metrics.globalRegistry));
```

### Health Checks
Implement health check endpoints:
```java
// Simple HTTP health check
HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
server.createContext("/health", exchange -> {
    String response = "{\"status\": \"UP\"}";
    exchange.sendResponseHeaders(200, response.length());
    exchange.getResponseBody().write(response.getBytes());
    exchange.close();
});
```

### Structured Logging
Use structured logging for better observability:
```java
import net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder;

// logback-spring.xml
<encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
    <providers>
        <timestamp/>
        <logLevel/>
        <loggerName/>
        <message/>
        <mdc/>
        <arguments/>
    </providers>
</encoder>
```

## Monitoring Output

The application provides comprehensive status updates:
- ✅ **Success**: File uploaded successfully with API response message and timing
- ❌ **Error**: Upload failed with detailed error context and stack traces
- 📄 **Detection**: New file detected (watch mode) with full file path and metadata
- 🔍 **Monitoring**: Directory being watched with configuration details
- 📊 **Summary**: Batch processing statistics with processed/failed counts and timing

## Troubleshooting

### Maven Issues
```bash
# Clear Maven cache
mvn dependency:purge-local-repository

# Force update dependencies
mvn clean compile -U

# Debug dependency conflicts
mvn dependency:tree
```

### Java Version Issues
```bash
# Check Java version
java -version
javac -version

# Set JAVA_HOME
export JAVA_HOME=/path/to/java17

# Verify Maven Java version
mvn -version
```

### Runtime Issues
```bash
# Enable debug logging
java -Dlogging.level.com.gloo.ai=DEBUG -jar app.jar

# JVM debugging
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005 -jar app.jar

# Memory analysis
java -XX:+PrintGCDetails -jar app.jar
```

### Network Issues
```bash
# Test API connectivity
curl -v https://platform.ai.gloo.com/oauth2/token

# Check proxy settings
java -Dhttps.proxyHost=proxy.company.com -Dhttps.proxyPort=8080 -jar app.jar
```

## Production Considerations

### Security
- Store credentials in secure vaults (HashiCorp Vault, AWS Secrets Manager)
- Use TLS 1.3 for all HTTP communications
- Implement proper input validation and sanitization
- Regular security audits and dependency updates

### Scalability
- Implement connection pooling and HTTP/2 support
- Use async processing with CompletableFuture for parallel operations
- Consider distributed processing with Apache Kafka or RabbitMQ
- Implement circuit breakers with Resilience4j

### Monitoring
- Integrate with APM tools (New Relic, AppDynamics, Elastic APM)
- Set up log aggregation with ELK Stack or Splunk
- Configure alerts for error rates and performance degradation
- Implement distributed tracing with Zipkin or Jaeger

## Next Steps

- Add support for additional file types with custom parsers
- Implement distributed processing with Spring Boot and Spring Cloud
- Add comprehensive metrics and monitoring with Micrometer + Prometheus
- Create REST API with Spring Web for remote content submission
- Implement message queue integration with Apache Kafka
- Add support for cloud storage sources (S3, GCS, Azure Blob)
- Create Spring Boot auto-configuration for easy integration
- Implement GraphQL API for flexible content querying
- Add comprehensive integration tests with TestContainers
- Implement event sourcing patterns for audit trails