# Gloo AI Documentation Cookbook

Welcome to the Gloo AI Documentation Cookbook - a comprehensive collection of working code samples demonstrating how to integrate with the Gloo AI platform across multiple programming languages.

## Overview

This repository serves as the reference for all Gloo AI tutorial code samples. Each tutorial provides production-ready, tested implementations in JavaScript, TypeScript, Python, PHP, Go, and Java.

## Available Tutorials

### 🔐 [Authentication](./authentication-tutorial/)
Learn how to authenticate with the Gloo AI API using OAuth2 credentials.

**Topics Covered:**
- OAuth2 client credentials flow
- Access token management
- Token refresh handling
- Environment variable configuration

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 💬 [Chat API](./chat-tutorial/)
Build interactive chat applications using the Gloo AI Message API.

**Topics Covered:**
- Creating chat sessions
- Sending and receiving messages
- Maintaining conversation context
- Retrieving chat history
- Error handling and validation

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 🤖 [Completions v1](./completions-v1-tutorial/)
Generate AI completions with custom parameters and filters.

**Topics Covered:**
- Basic completions API usage
- Response customization
- Publisher filtering
- Character and source limits
- Conversation history management

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 🚀 [Completions v2](./completions-v2-tutorial/)
Use the next-generation Completions API with intelligent routing strategies.

**Topics Covered:**
- Auto-routing (AI Core) for optimal model selection
- Model family selection (AI Core Select)
- Direct model specification (AI Select)
- Automatic token management
- Tradition-aware parameters

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 🛠️ [Completions with Tool Use](./completions-tool-use/)
Advanced completions with function calling and tool integration.

**Topics Covered:**
- Tool/function definitions
- Tool calling and execution
- Multi-turn conversations with tools
- Custom tool implementations
- Response handling and validation

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 📥 [Realtime Ingestion](./realtime-ingestion/) *(Deprecated)*
Ingest and manage content in real-time using the Gloo AI Data API.

> **Note:** This tutorial is deprecated. Please use the [Upload Files](./upload-files/) tutorial instead for the latest file ingestion approach.

**Topics Covered:**
- Content ingestion workflow
- Document management
- Metadata handling
- Batch operations
- Status tracking

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 📁 [Upload Files](./upload-files/)
Upload and manage files using the Gloo AI Data Engine Files API.

**Topics Covered:**
- Single file upload
- Batch upload operations
- Metadata management
- Supported file types (TXT, MD, PDF, DOC/DOCX)
- Error handling and validation

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

### 🔍 [Search API](./search-tutorial/)
Build custom search experiences using the Gloo AI Search API.

**Topics Covered:**
- Semantic (near-text) search with authentication
- Search result handling (snippets, metadata, relevance scores)
- Content type filtering
- RAG (Retrieval Augmented Generation) with Completions V2
- Proxy server for browser-based frontends
- Browser-based search UI example

**Languages:** JavaScript, TypeScript, Python, PHP, Go, Java

---

## Repository Structure

```
gloo-ai-docs-cookbook/
├── authentication-tutorial/
│   └── [javascript, typescript, python, php, go, java]
├── chat-tutorial/
│   └── [javascript, typescript, python, php, go, java]
├── completions-v1-tutorial/
│   └── [javascript, typescript, python, php, go, java]
├── completions-v2-tutorial/
│   └── [javascript, typescript, python, php, go, java]
├── completions-tool-use/
│   └── [javascript, typescript, python, php, go, java]
├── realtime-ingestion/
│   └── [javascript, typescript, python, php, go, java]
└── upload-files/
    └── [javascript, typescript, python, php, go, java]
```

Each language directory contains:
- Complete, runnable code samples
- `README.md` with setup instructions
- Language-specific dependency files
- Example configuration files

## Getting Started

### Prerequisites

Before using any tutorial, ensure you have:

1. **Gloo AI API Credentials**
   - Client ID
   - Client Secret
   - [Sign up for access](https://studio.ai.gloo.com/) if you don't have credentials

2. **Development Environment**
   - Choose your preferred programming language
   - Install the required runtime/compiler (see language-specific requirements below)

### Language-Specific Requirements

#### JavaScript
- **Runtime:** Node.js 18+
- **Package Manager:** npm
- **Setup:** `npm install`
- **Run:** `node index.js`

#### TypeScript
- **Runtime:** Node.js 18+
- **TypeScript:** 5.0+
- **Setup:** `npm install`
- **Run:** `npm start` or `npx ts-node index.ts`

#### Python
- **Version:** Python 3.9+
- **Setup:** `pip install -r requirements.txt`
- **Run:** `python main.py`
- **Recommended:** Use a virtual environment

#### PHP
- **Version:** PHP 8.1+
- **Package Manager:** Composer
- **Setup:** `composer install`
- **Run:** `php index.php`

#### Go
- **Version:** Go 1.20+
- **Setup:** `go mod download`
- **Run:** `go run main.go`

#### Java
- **Version:** Java 17+
- **Build Tool:** Maven
- **Setup:** `mvn install`
- **Run:** `mvn exec:java` or `java -jar target/[artifact].jar`

## Quick Start

1. **Choose a tutorial** based on what you want to learn
2. **Navigate to your preferred language directory**
   ```bash
   cd chat-tutorial/javascript
   ```
3. **Follow the README** in that directory for setup instructions
4. **Configure your credentials** (typically via environment variables)
   ```bash
   export GLOO_CLIENT_ID="your_client_id"
   export GLOO_CLIENT_SECRET="your_client_secret"
   ```
5. **Run the example** using the language-specific command

## Configuration

Most tutorials require API credentials to be set as environment variables:

```bash
# Required for all tutorials
export GLOO_CLIENT_ID="your_client_id_here"
export GLOO_CLIENT_SECRET="your_client_secret_here"
```

Alternatively, create a `.env` file in the tutorial directory:

```env
GLOO_CLIENT_ID=your_client_id_here
GLOO_CLIENT_SECRET=your_client_secret_here
```

## Testing

All code samples in this repository have been tested and verified to work correctly. Each implementation:

- ✅ Compiles/runs without errors
- ✅ Follows language-specific best practices
- ✅ Includes comprehensive error handling
- ✅ Produces consistent results across languages
- ✅ Includes inline documentation and comments

## Contributing

This repository contains verified sample code for the official Gloo AI documentation. All code samples are tested before publication.

To report issues or suggest improvements:
1. Check the specific tutorial's README for troubleshooting steps
2. Verify your credentials and environment setup
3. File a GitHub issue

## Best Practices

When using these samples:

1. **Security**
   - Never commit credentials to version control
   - Use environment variables for sensitive data
   - Rotate API credentials regularly

2. **Error Handling**
   - All samples include error handling examples
   - Implement retry logic for transient failures
   - Log errors appropriately for debugging

3. **Production Use**
   - Review and adapt code for your specific use case
   - Add logging and monitoring
   - Implement rate limiting and backoff strategies
   - Follow your organization's security guidelines

## Related Resources

- **[Gloo AI Documentation](https://docs.gloo.com)** - Complete documentation
- **[Gloo AI API Reference](https://docs.gloo.com/api-reference/general/overview)** - Detailed API documentation
- **[Gloo AI Tutorials](https://docs.gloo.com/tutorials/overview)** - Collection of recipes and tutorials

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
