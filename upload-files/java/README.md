# Upload Files - Java Example

This example demonstrates how to use the Gloo AI Data Engine Files API with Java to upload files directly for processing and AI-powered search.

## Features

- **Single File Upload**: Upload individual files with optional producer ID
- **Batch Upload**: Upload all supported files in a directory
- **Metadata Support**: Add metadata to uploaded files
- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for network and API issues

## Prerequisites

- Java 17+ installed
- Maven installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Compile the project:
```bash
mvn compile
```

2. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
GLOO_PUBLISHER_ID=your_publisher_id_here
```

Or set environment variables:
```bash
export GLOO_CLIENT_ID="your_actual_client_id_here"
export GLOO_CLIENT_SECRET="your_actual_client_secret_here"
export GLOO_PUBLISHER_ID="your_publisher_id_here"
```

## Usage

### Single File Upload
Upload a single file to the Data Engine:
```bash
mvn exec:java -Dexec.args="single ../sample_files/developer_happiness.txt"
```

With a custom producer ID:
```bash
mvn exec:java -Dexec.args="single ../sample_files/developer_happiness.txt my-doc-001"
```

### Batch Upload
Upload all supported files in a directory:
```bash
mvn exec:java -Dexec.args="batch ../sample_files"
```

### Upload with Metadata
Upload a file and add metadata:
```bash
mvn exec:java -Dexec.args="meta ../sample_files/developer_happiness.txt --title 'Developer Happiness' --author 'John Doe' --tags development,culture"
```

## Build JAR

To build a JAR file:
```bash
mvn package
java -jar target/upload-files-1.0.0.jar single ../sample_files/developer_happiness.txt
```

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files
- `.pdf` - PDF documents
- `.doc` / `.docx` - Microsoft Word documents

## Configuration

### Environment Variables
- `GLOO_CLIENT_ID`: Your Gloo AI Client ID (required)
- `GLOO_CLIENT_SECRET`: Your Gloo AI Client Secret (required)
- `GLOO_PUBLISHER_ID`: Your Publisher ID (required for metadata updates)

## Example Output

```
Uploading: ../sample_files/developer_happiness.txt
Token is expired or missing. Fetching a new one...
Upload successful!
  Message: File processing started in background.
  Ingesting: 1 file(s)
    - c999008e-de60-495c-8c9f-6a4b59cdb04b
```

## Next Steps

- [Search API](/api-guides/search) - Query your uploaded content
- [Content Controls](/api-guides/lifecycle-controls-overview) - Manage your content
- [API Reference](/api-reference/ingestion/v2) - Full endpoint documentation
