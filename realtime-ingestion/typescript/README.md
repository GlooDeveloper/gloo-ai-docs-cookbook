# Realtime Ingestion - TypeScript Example

This example demonstrates how to use the Gloo AI Realtime Ingestion API with TypeScript to automatically upload content and make it available for search and AI interaction.

## Features

- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Environment-based Authentication**: Secure credential management using .env files
- **File System Monitoring**: Automatic content upload when new files are added to a directory
- **Batch Processing**: Upload multiple files at once with rate limiting
- **Single File Upload**: Process individual files on demand
- **Error Handling**: Comprehensive error handling with type-safe error responses
- **Token Management**: Automatic token refresh when expired
- **Strict Mode**: Compiled with strict TypeScript settings for maximum reliability

## Prerequisites

- Node.js 18+ installed
- TypeScript 5.0+ (installed as dev dependency)
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

3. Update the `PUBLISHER_ID` in `index.ts` with your actual publisher ID.

## Usage

### Development Mode (with ts-node)
Run TypeScript directly without compilation:

#### Single File Upload
```bash
npx ts-node index.ts single path/to/your/file.txt
```

#### Directory Monitoring
```bash
npx ts-node index.ts watch ./content_directory
```

#### Batch Processing
```bash
npx ts-node index.ts batch ./content_directory
```

### Production Mode (compiled)
Build and run the compiled JavaScript:

```bash
npm run build
node dist/index.js single path/to/your/file.txt
```

### Using NPM Scripts
Convenient scripts are pre-configured in `package.json`:
```bash
npm run single    # Process sample article using ts-node
npm run watch     # Monitor sample_content directory
npm run batch     # Process all files in sample_content directory
npm run build     # Compile TypeScript to JavaScript
npm run start     # Build and run compiled version
```

## Type Definitions

The example includes comprehensive TypeScript interfaces:

### TokenInfo
```typescript
interface TokenInfo {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
}
```

### ContentData
```typescript
interface ContentData {
    content: string;
    publisherId: string;
    item_title: string;
    item_subtitle?: string;
    author: string[];
    publication_date: string;
    type: string;
    pub_type: string;
    item_tags: string[];
    evergreen: boolean;
    drm: string[];
    item_summary?: string;
    item_image?: string;
    item_url?: string;
}
```

### ApiResponse
```typescript
interface ApiResponse {
    success: boolean;
    message: string;
    task_id: string | null;
    batch_id: string | null;
    processing_details: any | null;
}
```

## Supported File Types

- `.txt` - Plain text files
- `.md` - Markdown files

The system includes type-safe file validation with the `isSupportedFile()` function.

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
- `GLOO_CLIENT_ID`: Your Gloo AI Client ID (required)
- `GLOO_CLIENT_SECRET`: Your Gloo AI Client Secret (required)

### Constants (modify in index.ts)
- `PUBLISHER_ID`: Your publisher UUID (required)
- `API_URL`: Realtime ingestion endpoint
- `TOKEN_URL`: OAuth2 token endpoint

## TypeScript Configuration

The project uses strict TypeScript settings in `tsconfig.json`:
- **Target**: ES2022 for modern JavaScript features
- **Strict Mode**: All strict type checking enabled
- **Module**: CommonJS for Node.js compatibility
- **Source Maps**: Enabled for debugging
- **Declaration Files**: Generated for library usage

## Content Metadata

The script automatically extracts and sets metadata with type safety:
- **Title**: Derived from filename with proper string manipulation
- **Author**: Strongly typed string array
- **Publication Date**: ISO date string format
- **Type**: Validated content type
- **Tags**: Typed string array
- **Boolean Flags**: Type-safe boolean values

## Error Handling

Type-safe error handling includes:
- **Authentication failures**: Automatic token refresh with typed responses
- **File system errors**: Typed error responses for missing files
- **Network issues**: HTTP request failures with structured error data
- **API errors**: Validation failures with type-safe error messages
- **Command validation**: Type guards for command validation

## Rate Limiting

The batch processor includes configurable rate limiting:
```typescript
await new Promise(resolve => setTimeout(resolve, 1000));
```

## Type Safety Features

- **Command Validation**: Type guards ensure only valid commands are processed
- **File Validation**: Type-safe file extension checking
- **Response Handling**: Fully typed API responses
- **Error Types**: Structured error handling with proper typing
- **Configuration**: Type-safe environment variable handling

## Development Tools

### Linting and Type Checking
```bash
# Type check without compilation
npx tsc --noEmit

# Build with type checking
npm run build
```

### Debugging
The compiled code includes source maps for debugging:
```bash
npm run build
node --inspect dist/index.js
```

## Monitoring Output

The script provides type-safe status updates:
- ✅ **Success**: File uploaded successfully with typed response
- ❌ **Error**: Upload failed with structured error information
- 📄 **Detection**: New file detected (watch mode) with file path
- 🔍 **Monitoring**: Directory being watched with configuration
- 📊 **Summary**: Batch processing statistics with typed results

## Troubleshooting

### TypeScript Compilation Issues
- Ensure TypeScript version 5.0+ is installed
- Check `tsconfig.json` for proper configuration
- Verify all type definitions are properly imported

### Authentication Issues
- Verify credentials are properly typed and not empty strings
- Ensure environment variables are loaded correctly
- Check token expiration logic with typed date comparisons

### File Processing Issues
- Verify file type validation with `isSupportedFile()` function
- Check file encoding is UTF-8
- Ensure proper error handling for file system operations

## Production Deployment

For production use:
1. Compile TypeScript: `npm run build`
2. Deploy the `dist/` directory
3. Use `node dist/index.js` to run
4. Set up proper environment variable management
5. Implement logging and monitoring

## Next Steps

- Extend type definitions for custom metadata structures
- Add validation schemas with libraries like Zod
- Implement comprehensive logging with typed log levels
- Create custom error classes with proper inheritance
- Add unit tests with Jest and TypeScript
- Integrate with continuous integration pipelines