# Upload Files - Go Example

This example demonstrates how to use the Gloo AI Data Engine Files API with Go to upload files directly for processing and AI-powered search.

## Features

- **Single File Upload**: Upload individual files with optional producer ID
- **Batch Upload**: Upload all supported files in a directory
- **Metadata Support**: Add metadata to uploaded files
- **Error Handling**: Comprehensive error handling for network and API issues

## Prerequisites

- Go 1.20+ installed
- Gloo AI Studio account
- Valid API Key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys)

## Installation

1. Install dependencies:
```bash
go mod tidy
```

2. Create a `.env` file in this directory:
```bash
GLOO_API_KEY=your_api_key_here
GLOO_PUBLISHER_ID=your_publisher_id_here
```

Or export environment variables:
```bash
export GLOO_API_KEY="your_api_key_here"
export GLOO_PUBLISHER_ID="your_publisher_id_here"
```

## Usage

### Single File Upload
Upload a single file to the Data Engine:
```bash
go run main.go single ../sample_files/developer_happiness.txt
```

With a custom producer ID:
```bash
go run main.go single ../sample_files/developer_happiness.txt my-doc-001
```

### Batch Upload
Upload all supported files in a directory:
```bash
go run main.go batch ../sample_files
```

### Upload with Metadata
Upload a file and add metadata:
```bash
go run main.go meta ../sample_files/developer_happiness.txt --title "Developer Happiness" --author "John Doe" --tags "development,culture"
```

## Build

To build a binary:
```bash
go build -o upload-files main.go
./upload-files single ../sample_files/developer_happiness.txt
```

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files
- `.pdf` - PDF documents
- `.doc` / `.docx` - Microsoft Word documents

## Configuration

### Environment Variables
- `GLOO_API_KEY`: Your Gloo AI API Key (required)
- `GLOO_PUBLISHER_ID`: Your Publisher ID (required for metadata updates)

## Example Output

```
Uploading: ../sample_files/developer_happiness.txt
Upload successful!
  Message: File processing started in background.
  Ingesting: 1 file(s)
    - c999008e-de60-495c-8c9f-6a4b59cdb04b
```

## Next Steps

- [Search API](/api-guides/search) - Query your uploaded content
- [Content Controls](/api-guides/lifecycle-controls-overview) - Manage your content
- [API Reference](/api-reference/ingestion/v2) - Full endpoint documentation
