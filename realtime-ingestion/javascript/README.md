# Realtime Ingestion - JavaScript Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with JavaScript/Node.js to automatically upload content and make it available for search and AI interaction.

## Features

- **Environment-based Authentication**: Secure credential management using .env files
- **File System Monitoring**: Automatic content upload when new files are added to a directory
- **Batch Processing**: Upload multiple files at once with rate limiting
- **Single File Upload**: Process individual files on demand
- **Error Handling**: Comprehensive error handling with retry logic for authentication
- **Token Management**: Automatic token refresh when expired

## Prerequisites

- Node.js 18+ installed
- Gloo AI Studio account
- Valid Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in this directory:
```bash
GLOO_CLIENT_ID=your_actual_client_id_here
GLOO_CLIENT_SECRET=your_actual_client_secret_here
```

3. Update the `PUBLISHER_ID` in `index.js` with your actual publisher ID.

## Usage

### Single File Upload
Upload a single file to the Realtime API:
```bash
node index.js single path/to/your/file.txt
```

### Directory Monitoring
Monitor a directory for new files and automatically upload them:
```bash
node index.js watch ./content_directory
```

This will:
- Create the directory if it doesn't exist
- Monitor for new `.txt` and `.md` files
- Automatically upload new files as they're added
- Continue monitoring until stopped with Ctrl+C

### Batch Processing
Process all supported files in a directory at once:
```bash
node index.js batch ./content_directory
```

This will:
- Find all `.txt` and `.md` files in the directory
- Upload them one by one with rate limiting
- Report success/failure statistics

### Using NPM Scripts
Convenient scripts are pre-configured in `package.json`:
```bash
npm run single    # Process sample article
npm run watch     # Monitor sample_content directory
npm run batch     # Process all files in sample_content directory
```

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

## Example Content

Create a sample file to test:
```bash
mkdir sample_content
echo "This is a sample article about content ingestion using the Gloo AI Realtime API." > sample_content/sample_article.txt
```

Then run:
```bash
npm run single
```

## Configuration

### Environment Variables
- `GLOO_CLIENT_ID`: Your Gloo AI Client ID
- `GLOO_CLIENT_SECRET`: Your Gloo AI Client Secret

### Constants (modify in index.js)
- `PUBLISHER_ID`: Your publisher UUID
- `API_URL`: Realtime ingestion endpoint
- `TOKEN_URL`: OAuth2 token endpoint

## Content Metadata

The script automatically extracts and sets:
- **Title**: Derived from filename (underscores/hyphens become spaces, title case)
- **Author**: Set to "Automated Ingestion" 
- **Publication Date**: Current date
- **Type**: "Article"
- **Tags**: ["automated", "ingestion"]
- **Content Type**: "technical"
- **DRM**: ["aspen", "kallm"]
- **Evergreen**: true

## Error Handling

The script handles:
- **Authentication failures**: Automatic token refresh
- **File system errors**: Missing files or directories
- **Network issues**: HTTP request failures with detailed error messages
- **API errors**: Validation failures and rate limiting

## Rate Limiting

The batch processor includes a 1-second delay between uploads to avoid overwhelming the API. Adjust this delay in the code if needed based on your rate limits.

## Monitoring Output

The script provides clear status updates:
- ✅ **Success**: File uploaded successfully
- ❌ **Error**: Upload failed with reason
- 📄 **Detection**: New file detected (watch mode)
- 🔍 **Monitoring**: Directory being watched
- 📊 **Summary**: Batch processing statistics

## Troubleshooting

### Authentication Issues
- Verify your credentials are correct in the `.env` file
- Ensure your Client ID and Secret have the required permissions
- Check that the credentials haven't expired

### File Processing Issues
- Ensure files are UTF-8 encoded
- Verify file permissions allow reading
- Check that the PUBLISHER_ID is valid for your account

### Network Issues
- Verify internet connectivity
- Check if corporate firewalls are blocking the API endpoints
- Ensure the API endpoints are accessible from your network

## Next Steps

- Customize metadata extraction based on your content structure
- Add support for additional file types
- Integrate with your existing content management systems
- Implement custom retry logic for your specific use cases
- Add logging and monitoring for production deployments