# Realtime Ingestion - PHP Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with PHP to automatically upload content and make it available for search and AI interaction.

## Features

- **Modern PHP**: Uses PHP 8.1+ features with strong typing and modern patterns
- **Clean Architecture**: Object-oriented design with separate classes for token management, content processing, and file monitoring
- **Environment-based Authentication**: Secure credential management using .env files with phpdotenv
- **HTTP Client**: Guzzle HTTP client for robust API communication with timeout and error handling
- **File System Monitoring**: Directory polling for automatic content upload (simple but effective)
- **Batch Processing**: Upload multiple files at once with configurable rate limiting
- **Single File Upload**: Process individual files on demand
- **Comprehensive Error Handling**: Detailed error reporting for all failure scenarios
- **Token Management**: Automatic token refresh with proper lifecycle management
- **PSR Standards**: Follows PSR-4 autoloading and coding standards
- **Composer Integration**: Modern dependency management with useful scripts

## Prerequisites

- PHP 8.1+ installed
- Composer installed for dependency management
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Install dependencies using Composer:
```bash
composer install
```

2. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

3. Update the `PUBLISHER_ID` constant in the `Config` class within `index.php` with your actual publisher ID.

## Usage

### Single File Upload
Upload a single file to the Realtime API:
```bash
php index.php single path/to/your/file.txt
```

### Directory Monitoring
Monitor a directory for new files and automatically upload them:
```bash
php index.php watch ./content_directory
```

This will:
- Create the directory if it doesn't exist
- Monitor for new `.txt` and `.md` files using polling (checks every 2 seconds)
- Automatically upload new files as they're detected
- Continue monitoring until stopped with Ctrl+C

### Batch Processing
Process all supported files in a directory at once:
```bash
php index.php batch ./content_directory
```

This will:
- Find all `.txt` and `.md` files in the directory using glob patterns
- Upload them one by one with rate limiting
- Report success/failure statistics

### Using Composer Scripts
Convenient scripts are pre-configured in `composer.json`:
```bash
composer run single    # Process sample article
composer run batch     # Process all files in sample_content directory
composer run watch     # Monitor sample_content directory
```

## Architecture

The code follows modern PHP practices with clean separation of concerns:

### Config Class
Central configuration management:
- API endpoints and credentials
- Supported file extensions
- Rate limiting configuration
- Publisher ID management

### TokenManager Class
Handles OAuth2 token lifecycle:
- `getAccessToken()`: Retrieves new tokens with proper error handling
- `isTokenExpired()`: Checks expiration with 60-second buffer
- `getValidToken()`: Returns valid token, refreshing if necessary
- Uses Guzzle HTTP client for reliable API communication

### ContentProcessor Class
Manages content processing and uploads:
- `processFile()`: Complete file processing pipeline with validation
- `uploadContent()`: API communication with structured error handling
- `createContentData()`: Content metadata generation
- `extractTitleFromFilename()`: Smart title extraction and formatting
- `isSupportedFile()`: File type validation

### DirectoryWatcher Class
Handles file system monitoring:
- `watch()`: Directory monitoring with graceful shutdown
- `scanForNewFiles()`: Efficient file detection using glob patterns
- File modification time tracking to avoid duplicate processing
- Signal handling for clean shutdown (where supported)

### RealtimeIngestionApp Class
Main application controller:
- `batchProcessDirectory()`: Bulk file processing with statistics
- `startWatching()`: Directory monitoring setup
- `processSingleFile()`: Individual file handling
- Credential validation and application initialization

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

File types are centrally configured in the `Config::SUPPORTED_EXTENSIONS` constant.

## Example Content

Create a sample file to test:
```bash
mkdir sample_content
cat > sample_content/sample_article.txt << 'EOF'
This is a sample article about content ingestion using the Gloo AI Realtime API.

The PHP implementation provides robust error handling, automatic token management, 
and efficient file monitoring capabilities using modern PHP patterns.
EOF
```

Then run:
```bash
php index.php single ./sample_content/sample_article.txt
```

Or use the composer script:
```bash
composer run single
```

## Configuration

### Environment Variables (.env file)
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

### Constants (modify Config class in index.php)
- `PUBLISHER_ID`: Your publisher UUID (required)
- `API_URL`: Realtime ingestion endpoint
- `TOKEN_URL`: OAuth2 token endpoint
- `SUPPORTED_EXTENSIONS`: Array of supported file extensions
- `RATE_LIMIT_DELAY`: Delay between API calls in seconds

## Content Metadata

The script automatically extracts and sets:
- **Title**: Derived from filename (underscores/hyphens become spaces, title case)
- **Author**: Array with "Automated Ingestion"
- **Publication Date**: Current date in YYYY-MM-DD format
- **Type**: "Article"
- **Tags**: Array ["automated", "ingestion"]
- **Content Type**: "technical"
- **DRM**: Array ["aspen", "kallm"]
- **Evergreen**: Boolean true

## Error Handling

The PHP implementation includes comprehensive error handling:

### Authentication Errors
- Credential validation on startup
- Automatic token refresh with detailed error messages
- HTTP timeout handling (30 seconds)
- Malformed response detection

### File System Errors
- File existence validation using `file_exists()`
- File readability checking with `is_readable()`
- Empty file detection
- File type validation using extension checking

### Network Errors
- Guzzle HTTP client with timeout configuration
- RequestException handling with detailed messages
- Connection error reporting
- API response validation

### API Errors
- HTTP status code validation
- JSON response parsing with error detection
- Structured error reporting with context

## Rate Limiting

The system includes configurable rate limiting:
```php
sleep(Config::RATE_LIMIT_DELAY); // 1 second by default
```

Adjust `Config::RATE_LIMIT_DELAY` based on your API rate limits.

## File Monitoring

The directory watcher uses a simple but effective polling approach:
- **Cross-platform**: Works on any system with PHP
- **Efficient**: Uses glob patterns for file detection
- **Reliable**: Tracks file modification times to avoid duplicates
- **Configurable**: 2-second polling interval (adjustable)

For high-volume production use, consider using:
- inotify extension on Linux
- External file system monitoring tools
- Message queue systems for large-scale processing

## Dependencies

The project uses modern, well-maintained PHP packages:

### Guzzle HTTP Client (^7.8)
- Robust HTTP client with extensive features
- Built-in retry logic and error handling
- Timeout and connection management
- JSON request/response handling

### vlucas/phpdotenv (^5.5)
- Secure environment variable management
- .env file parsing and loading
- Production-safe configuration handling

## PHP Version Requirements

- **PHP 8.1+**: Uses modern PHP features including:
  - Constructor property promotion
  - Named arguments
  - Match expressions
  - Readonly properties support
  - Strong typing with union types

## Development

### Code Quality
The code follows PHP best practices:
- PSR-4 autoloading structure
- Strong typing with parameter and return types
- Modern exception handling
- Consistent code formatting
- Comprehensive documentation

### PSR Standards
- **PSR-1**: Basic coding standard compliance
- **PSR-4**: Autoloader standard (ready for namespace organization)
- **PSR-12**: Extended coding style guide

### Testing
For production use, consider adding PHPUnit tests:
```php
<?php
use PHPUnit\Framework\TestCase;

class ContentProcessorTest extends TestCase
{
    public function testExtractTitleFromFilename(): void
    {
        $tokenManager = new TokenManager(new Client(), 'test', 'test');
        $processor = new ContentProcessor($tokenManager, new Client());
        
        $title = $processor->extractTitleFromFilename('hello_world.txt');
        $this->assertEquals('Hello World', $title);
    }
}
```

## Monitoring Output

The script provides detailed, emoji-enhanced status updates:
- ✅ **Success**: File uploaded successfully with API response message
- ❌ **Error**: Upload failed with specific error details and context
- 📄 **Detection**: New file detected (watch mode) with full file path
- 🔍 **Monitoring**: Directory being watched with configuration details
- 📊 **Summary**: Batch processing statistics with processed/failed counts

## Signal Handling

On systems with PCNTL support, the script handles signals gracefully:
- **SIGINT (Ctrl+C)**: Graceful shutdown with cleanup message
- **Signal Dispatch**: Proper signal processing during monitoring loops

## Production Deployment

### Web Server Integration
For web-based deployment:
```php
// Example: Laravel integration
Route::post('/ingest', function (Request $request) {
    $app = new RealtimeIngestionApp();
    return $app->processSingleFile($request->file('content')->path());
});
```

### CLI Daemon
For long-running processes:
```bash
# Using systemd
sudo systemctl create php-ingestion.service

# Using supervisor
[program:php-ingestion]
command=php /path/to/index.php watch /content/directory
autostart=true
autorestart=true
```

### Docker Deployment
```dockerfile
FROM php:8.1-cli
RUN apt-get update && apt-get install -y git unzip
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY . .
RUN composer install --no-dev --optimize-autoloader
CMD ["php", "index.php", "watch", "/content"]
```

## Troubleshooting

### Composer Issues
```bash
# If composer install fails
composer diagnose
composer clear-cache
composer install --no-scripts

# Update dependencies
composer update
```

### PHP Extension Issues
```bash
# Check required extensions
php -m | grep -E "(curl|json|mbstring)"

# Install missing extensions (Ubuntu/Debian)
sudo apt-get install php-curl php-json php-mbstring
```

### File Permissions
```bash
# Ensure PHP can read content files
chmod -R 644 sample_content/
chmod +x index.php

# Check file ownership
ls -la sample_content/
```

### Memory Issues
For large file processing:
```php
// Increase memory limit in php.ini
memory_limit = 512M

// Or in code (not recommended for production)
ini_set('memory_limit', '512M');
```

### Authentication Issues
- Verify credentials in `.env` file are correct
- Check that `.env` file is in the correct directory
- Ensure your Client ID and Secret have required permissions
- Test credentials with a simple API call first

### Network Issues
- Verify internet connectivity to API endpoints
- Check corporate firewall settings
- Test with curl to verify API accessibility:
```bash
curl -I https://platform.ai.gloo.com/oauth2/token
```

## Performance Optimization

### For High Volume Processing
- Implement parallel processing using PHP's `pcntl_fork()`
- Use message queues (Redis, RabbitMQ) for async processing
- Consider using ReactPHP for non-blocking I/O
- Implement database queuing for failed uploads

### Memory Management
- Process files in batches to limit memory usage
- Use generators for large file processing
- Implement garbage collection for long-running processes

## Next Steps

- Add support for additional file types (PDF, Word, etc.)
- Implement database logging for processing history
- Add web interface for monitoring and configuration
- Create Laravel/Symfony packages for framework integration
- Add support for remote file sources (S3, FTP, etc.)
- Implement webhook endpoints for external triggers
- Add comprehensive logging with Monolog
- Create Docker containers for easy deployment