# Realtime Ingestion - Go Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with Go to automatically upload content and make it available for search and AI interaction.

## Features

- **Modern Go**: Uses Go 1.20+ with modules and modern Go patterns
- **Clean Architecture**: Well-structured code with separate packages for token management, content processing, and file monitoring
- **Environment-based Authentication**: Secure credential management using .env files with godotenv
- **Native HTTP Client**: Uses Go's standard `net/http` package with proper timeout handling
- **File System Monitoring**: Real-time file watching using `fsnotify` for cross-platform compatibility
- **Batch Processing**: Upload multiple files at once with configurable rate limiting
- **Single File Upload**: Process individual files on demand
- **Comprehensive Error Handling**: Proper Go error handling with detailed error wrapping
- **Token Management**: Automatic token refresh with proper lifecycle management
- **Concurrent Safe**: Thread-safe design suitable for concurrent operations
- **Production Ready**: Robust error handling, logging, and resource management

## Prerequisites

- Go 1.20+ installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Initialize Go module and install dependencies:
```bash
go mod tidy
```

2. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

3. Update the `publisherID` constant in `main.go` with your actual publisher ID.

## Usage

### Single File Upload
Upload a single file to the Realtime API:
```bash
go run main.go single path/to/your/file.txt
```

### Directory Monitoring
Monitor a directory for new files and automatically upload them:
```bash
go run main.go watch ./content_directory
```

This will:
- Create the directory if it doesn't exist
- Monitor for new `.txt` and `.md` files using native file system events
- Automatically upload new files as they're created
- Continue monitoring until stopped with Ctrl+C

### Batch Processing
Process all supported files in a directory at once:
```bash
go run main.go batch ./content_directory
```

This will:
- Find all `.txt` and `.md` files in the directory using glob patterns
- Upload them one by one with rate limiting
- Report success/failure statistics

## Architecture

The Go implementation follows clean architecture principles with clear separation of concerns:

### TokenManager
Handles OAuth2 token lifecycle with proper error handling:
- `GetAccessToken()`: Retrieves new tokens with HTTP client configuration
- `IsTokenExpired()`: Checks expiration with 60-second buffer
- Uses standard `net/http` package with timeout configuration
- Proper error wrapping and context propagation

### ContentProcessor
Manages content processing and uploads:
- `ProcessFile()`: Complete file processing pipeline with validation
- `UploadContent()`: API communication with structured error handling
- `CreateContentData()`: Content metadata generation with proper struct tags
- `ExtractTitleFromFilename()`: Smart title extraction and formatting
- `IsSupportedFile()`: Efficient file type validation using map lookup

### DirectoryWatcher
Handles real-time file system monitoring:
- `Watch()`: Directory monitoring using `fsnotify` library
- Cross-platform file system event handling
- Event filtering for supported file types
- Graceful shutdown and resource cleanup

### BatchProcessor
Manages bulk file processing:
- `ProcessDirectory()`: Bulk file processing with glob pattern matching
- Statistics tracking for processed and failed files
- Rate limiting with configurable delays
- Progress reporting and error aggregation

### Application
Main application controller with dependency injection:
- Clean initialization and dependency management
- Command-line argument parsing and validation
- Centralized error handling and logging
- Graceful resource cleanup

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

File types are efficiently validated using a map-based lookup for O(1) performance.

## Example Content

Create a sample file to test:
```bash
mkdir sample_content
cat > sample_content/sample_article.txt << 'EOF'
This is a sample article about content ingestion using the Gloo AI Realtime API.

The Go implementation provides excellent performance, robust error handling, 
and native cross-platform file system monitoring capabilities.
EOF
```

Then run:
```bash
go run main.go single ./sample_content/sample_article.txt
```

## Configuration

### Environment Variables (.env file)
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

### Constants (modify in main.go)
- `publisherID`: Your publisher UUID (required)
- `apiURL`: Realtime ingestion endpoint
- `tokenURL`: OAuth2 token endpoint

## Content Metadata

The system automatically extracts and sets metadata using Go structs with JSON tags:
- **Title**: Derived from filename with proper case conversion
- **Author**: String slice with "Automated Ingestion"
- **Publication Date**: Current date in RFC 3339 format
- **Type**: "Article"
- **Tags**: String slice ["automated", "ingestion"]
- **Content Type**: "technical"
- **DRM**: String slice ["aspen", "kallm"]
- **Evergreen**: Boolean true

## Error Handling

The Go implementation uses idiomatic error handling patterns:

### Error Wrapping
```go
if err != nil {
    return fmt.Errorf("failed to process file: %w", err)
}
```

### Structured Errors
- Authentication errors with detailed HTTP response information
- File system errors with specific failure reasons
- Network errors with timeout and connection details
- API errors with HTTP status codes and response bodies

### Error Propagation
- Proper error context preservation through the call stack
- Detailed error messages for debugging and troubleshooting
- Graceful error recovery where appropriate

## File System Monitoring

The implementation uses the `fsnotify` library for efficient, cross-platform file system monitoring:

### Features
- **Event-driven**: Immediate response to file system changes
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Efficient**: Low CPU usage and minimal resource overhead
- **Reliable**: Handles edge cases like rapid file creation/deletion

### Supported Events
- File creation (`fsnotify.Create`)
- Proper event filtering for supported file types
- Delay handling to ensure file writes are complete

## Dependencies

The project uses minimal, well-maintained Go modules:

### fsnotify/fsnotify (v1.7.0)
- Cross-platform file system notification library
- Mature, stable, and widely used in the Go ecosystem
- Efficient event-driven file monitoring

### joho/godotenv (v1.5.1)
- Environment variable loading from .env files
- Simple, secure configuration management
- Production-ready with proper error handling

## Performance Characteristics

### Memory Usage
- Minimal memory footprint with efficient struct design
- Proper resource cleanup and garbage collection
- Stream-based file processing for large files

### CPU Usage
- Efficient file type checking using map lookups
- Minimal CPU overhead for file system monitoring
- Concurrent-safe design for parallel processing

### Network Efficiency
- HTTP connection reuse with proper client configuration
- Timeout handling to prevent hanging connections
- Efficient JSON marshaling/unmarshaling

## Development

### Code Quality
The code follows Go best practices:
- Proper error handling with error wrapping
- Consistent naming conventions (camelCase for private, PascalCase for public)
- Clear struct organization with appropriate field tags
- Comprehensive documentation for all exported functions

### Go Modules
```bash
# Initialize module
go mod init gloo.ai/realtime-ingestion

# Add dependencies
go get github.com/fsnotify/fsnotify@v1.7.0
go get github.com/joho/godotenv@v1.5.1

# Clean up and verify
go mod tidy
go mod verify
```

### Testing
Create unit tests following Go conventions:
```go
func TestExtractTitleFromFilename(t *testing.T) {
    processor := NewContentProcessor(nil)
    title := processor.ExtractTitleFromFilename("hello_world.txt")
    if title != "Hello World" {
        t.Errorf("Expected 'Hello World', got %s", title)
    }
}
```

### Benchmarking
Go provides excellent benchmarking support:
```go
func BenchmarkProcessFile(b *testing.B) {
    processor := NewContentProcessor(tokenManager)
    for i := 0; i < b.N; i++ {
        processor.ProcessFile("test.txt")
    }
}
```

## Building and Deployment

### Build for Production
```bash
# Build for current platform
go build -o realtime-ingestion main.go

# Build for Linux
GOOS=linux GOARCH=amd64 go build -o realtime-ingestion-linux main.go

# Build for Windows
GOOS=windows GOARCH=amd64 go build -o realtime-ingestion.exe main.go

# Build with optimizations
go build -ldflags "-s -w" -o realtime-ingestion main.go
```

### Docker Deployment
```dockerfile
FROM golang:1.20-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -ldflags "-s -w" -o realtime-ingestion main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/realtime-ingestion .
CMD ["./realtime-ingestion", "watch", "/content"]
```

### Systemd Service
```ini
[Unit]
Description=Gloo AI Realtime Content Ingestion
After=network.target

[Service]
Type=simple
User=gloo
WorkingDirectory=/opt/gloo-ingestion
ExecStart=/opt/gloo-ingestion/realtime-ingestion watch /content
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Monitoring Output

The application provides clear, emoji-enhanced status updates:
- ✅ **Success**: File uploaded successfully with API response message
- ❌ **Error**: Upload failed with detailed error context and Go error information
- 📄 **Detection**: New file detected (watch mode) with full file path
- 🔍 **Monitoring**: Directory being watched with configuration details
- 📊 **Summary**: Batch processing statistics with processed/failed counts

## Signal Handling

The Go implementation handles signals gracefully:
- **SIGINT (Ctrl+C)**: Graceful shutdown with resource cleanup
- **SIGTERM**: Proper application termination
- Resource cleanup for file watchers and HTTP clients

## Troubleshooting

### Go Module Issues
```bash
# Clean module cache
go clean -modcache

# Re-download dependencies
go mod download

# Verify dependencies
go mod verify

# Update dependencies
go get -u all
```

### Build Issues
```bash
# Check Go version
go version

# Verify GOPATH and GOROOT
go env GOPATH
go env GOROOT

# Clean build cache
go clean -cache
```

### Runtime Issues
```bash
# Check file permissions
ls -la sample_content/

# Test credentials
curl -u "$GLOO_CLIENT_ID:$GLOO_CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=api/access" \
  https://platform.ai.gloo.com/oauth2/token
```

### Performance Issues
Use Go's built-in profiling tools:
```bash
# CPU profiling
go run main.go -cpuprofile=cpu.prof batch ./large_directory

# Memory profiling  
go run main.go -memprofile=mem.prof batch ./large_directory

# Analyze profiles
go tool pprof cpu.prof
go tool pprof mem.prof
```

## Production Considerations

### Logging
For production deployments, implement structured logging:
```go
import "log/slog"

logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
logger.Info("Processing file", "path", filePath, "size", fileSize)
```

### Health Checks
Implement HTTP health check endpoints:
```go
http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
})
```

### Metrics
Use Prometheus metrics for monitoring:
```go
import "github.com/prometheus/client_golang/prometheus"

var (
    filesProcessed = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "files_processed_total",
            Help: "Total number of files processed",
        },
        []string{"status"},
    )
)
```

### Configuration Management
Use structured configuration:
```go
type Config struct {
    ClientID     string `env:"GLOO_CLIENT_ID" required:"true"`
    ClientSecret string `env:"GLOO_CLIENT_SECRET" required:"true"`
    PublisherID  string `env:"GLOO_PUBLISHER_ID" required:"true"`
    APITimeout   time.Duration `env:"API_TIMEOUT" default:"30s"`
}
```

## Next Steps

- Add support for additional file types with custom parsers
- Implement distributed processing with goroutines and worker pools
- Add comprehensive metrics and monitoring with Prometheus
- Create gRPC API for remote content submission
- Implement content deduplication and validation
- Add support for cloud storage sources (S3, GCS, Azure)
- Create CLI with cobra for better command-line interface
- Implement plugin architecture for extensible content processing