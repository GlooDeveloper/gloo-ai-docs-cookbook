# Realtime Ingestion - Python Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with Python to automatically upload content and make it available for search and AI interaction.

## Features

- **Clean Architecture**: Organized with separate classes for token management, content processing, and file handling
- **Environment-based Authentication**: Secure credential management using .env files
- **File System Monitoring**: Automatic content upload when new files are added to a directory using Watchdog
- **Batch Processing**: Upload multiple files at once with rate limiting
- **Single File Upload**: Process individual files on demand
- **Comprehensive Error Handling**: Robust error handling for network, file system, and API issues
- **Token Management**: Automatic token refresh when expired with proper lifecycle management
- **Type Hints**: Modern Python with type annotations for better code quality
- **Pathlib Integration**: Modern path handling using Python's pathlib
- **Unicode Support**: Proper UTF-8 file handling with encoding error detection

## Prerequisites

- Python 3.9+ installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

4. Update the `PUBLISHER_ID` in `main.py` with your actual publisher ID.

## Usage

### Single File Upload
Upload a single file to the Realtime API:
```bash
python main.py single path/to/your/file.txt
```

### Directory Monitoring
Monitor a directory for new files and automatically upload them:
```bash
python main.py watch ./content_directory
```

This will:
- Create the directory if it doesn't exist
- Monitor for new `.txt` and `.md` files
- Automatically upload new files as they're added
- Continue monitoring until stopped with Ctrl+C

### Batch Processing
Process all supported files in a directory at once:
```bash
python main.py batch ./content_directory
```

This will:
- Find all `.txt` and `.md` files in the directory
- Upload them one by one with rate limiting
- Report success/failure statistics

## Architecture

The code is organized into several classes for maintainability:

### TokenManager
Handles OAuth2 token lifecycle:
- `get_access_token()`: Retrieves new tokens from the OAuth2 endpoint
- `is_token_expired()`: Checks token expiration with 60-second buffer

### ContentProcessor
Manages content processing and uploads:
- `process_file()`: Complete file processing pipeline
- `upload_content()`: API communication with error handling
- `create_content_data()`: Content metadata generation
- `extract_title_from_filename()`: Smart title extraction

### ContentHandler (FileSystemEventHandler)
Handles file system events for real-time monitoring:
- `on_created()`: Responds to new file creation events
- Integrates with Watchdog for cross-platform file monitoring

### RealtimeIngestionApp
Main application controller:
- `start_file_watcher()`: Directory monitoring setup
- `batch_process_directory()`: Bulk file processing
- `process_single_file()`: Individual file handling

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

File type validation is handled by the `is_supported_file()` method.

## Example Content

Create a sample file to test:
```bash
mkdir sample_content
cat > sample_content/sample_article.txt << EOF
This is a sample article about content ingestion using the Gloo AI Realtime API.

The Python implementation provides robust error handling, automatic token management, and real-time file monitoring capabilities.
EOF
```

Then run:
```bash
python main.py single ./sample_content/sample_article.txt
```

## Configuration

### Environment Variables
- `GLOO_CLIENT_ID`: Your Gloo AI Client ID (required)
- `GLOO_CLIENT_SECRET`: Your Gloo AI Client Secret (required)

### Constants (modify in main.py)
- `PUBLISHER_ID`: Your publisher UUID (required)
- `API_URL`: Realtime ingestion endpoint
- `TOKEN_URL`: OAuth2 token endpoint

## Content Metadata

The script automatically extracts and sets:
- **Title**: Derived from filename (underscores/hyphens become spaces, title case)
- **Author**: Set to ["Automated Ingestion"]
- **Publication Date**: Current date in YYYY-MM-DD format
- **Type**: "Article"
- **Tags**: ["automated", "ingestion"]
- **Content Type**: "technical"
- **DRM**: ["aspen", "kallm"]
- **Evergreen**: True

## Error Handling

The Python implementation includes comprehensive error handling:

### Authentication Errors
- Automatic token refresh with proper error messages
- Credential validation on startup
- Timeout handling for OAuth2 requests

### File System Errors
- File existence validation
- UTF-8 encoding error detection
- Empty file detection
- Permission error handling

### Network Errors
- HTTP request timeouts (30 seconds)
- Connection error handling
- API response validation
- Rate limiting compliance

### API Errors
- Structured error response parsing
- HTTP status code validation
- Detailed error reporting

## Rate Limiting

The batch processor includes a 1-second delay between uploads:
```python
time.sleep(1)  # Rate limiting
```

Adjust this value based on your specific rate limits and requirements.

## File Monitoring

The file watcher uses Python's Watchdog library for cross-platform file system monitoring:
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Recursive**: Can monitor subdirectories
- **Event-driven**: Responds immediately to file creation
- **Resource-efficient**: Low CPU usage for monitoring

## Virtual Environment

For production deployments, always use a virtual environment:

```bash
# Create virtual environment
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run application
python main.py watch ./content
```

## Monitoring Output

The script provides detailed status updates:
- ✅ **Success**: File uploaded successfully with API response message
- ❌ **Error**: Upload failed with specific error details
- 📄 **Detection**: New file detected (watch mode) with full path
- 🔍 **Monitoring**: Directory being watched with configuration
- 📊 **Summary**: Batch processing statistics with counts

## Development

### Code Quality
The code follows Python best practices:
- Type hints for better IDE support and debugging
- Docstrings for all classes and methods
- PEP 8 compliant formatting
- Modern Python features (pathlib, f-strings)
- Exception handling with specific error types

### Logging
For production use, consider adding structured logging:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
```

### Testing
Create unit tests for the main components:
```python
import unittest
from unittest.mock import patch, mock_open

class TestContentProcessor(unittest.TestCase):
    def test_extract_title_from_filename(self):
        processor = ContentProcessor(TokenManager())
        title = processor.extract_title_from_filename("hello_world.txt")
        self.assertEqual(title, "Hello World")
```

## Troubleshooting

### Virtual Environment Issues
```bash
# If pip install fails, try upgrading pip
python -m pip install --upgrade pip

# If watchdog installation fails on Windows
pip install watchdog --no-deps
pip install pathtools
```

### Authentication Issues
- Verify credentials are correct in `.env` file
- Check that environment variables are loaded properly
- Ensure your Client ID and Secret have required permissions

### File Processing Issues
- Verify files are UTF-8 encoded
- Check file permissions allow reading
- Ensure the PUBLISHER_ID is valid for your account
- Test with small files first

### Watchdog Issues
- On some systems, you may need platform-specific watchdog dependencies
- For high-volume monitoring, consider adjusting the polling interval
- Check system-specific file system limitations

### Network Issues
- Verify internet connectivity to api endpoints
- Check corporate firewall settings
- Test with curl to verify API accessibility

## Production Deployment

For production use:
1. Use a proper Python web server like Gunicorn
2. Implement structured logging with log rotation
3. Add health check endpoints
4. Use environment-specific configuration
5. Implement monitoring and alerting
6. Set up proper error tracking (e.g., Sentry)
7. Use Docker for containerized deployment

## Next Steps

- Add support for additional file types (PDF, Word, etc.)
- Implement custom metadata extraction based on content analysis
- Add database logging for processing history
- Create a web interface for monitoring and configuration
- Integrate with content management systems
- Add support for remote file sources (S3, FTP, etc.)
- Implement parallel processing for high-volume scenarios