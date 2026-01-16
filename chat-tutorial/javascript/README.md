# Gloo AI Chat Message Tutorial - JavaScript

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using JavaScript/Node.js.

## Features

- ✅ OAuth2 authentication with automatic token refresh
- ✅ Create new chat sessions
- ✅ Continue conversations with context
- ✅ Retrieve and display chat history
- ✅ Error handling and validation
- ✅ Human flourishing conversation examples

## Prerequisites

- Node.js 18 or higher
- npm package manager
- Gloo AI API credentials (Client ID and Client Secret)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```env
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

   Or export them in your shell:
   ```bash
   export GLOO_CLIENT_ID="your_client_id_here"
   export GLOO_CLIENT_SECRET="your_client_secret_here"
   ```

## Running the Example

**Basic usage:**
```bash
npm start
```

**Alternative:**
```bash
node index.js
```

## Expected Output

The example will:
1. Authenticate with the Gloo AI API
2. Ask a deep question about finding meaning and purpose
3. Follow up with practical questions
4. Display the complete conversation history

## API Endpoints Used

- `POST /oauth2/token` - Authentication
- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Code Structure

- `getAccessToken()` - Handles OAuth2 authentication
- `sendMessage()` - Sends messages to the chat API
- `getChatHistory()` - Retrieves conversation history
- `main()` - Demonstrates the complete flow

## Error Handling

The example includes proper error handling for:
- Authentication failures
- API rate limits
- Network connectivity issues
- Invalid responses

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers

## Troubleshooting

**Common issues:**

1. **"Please set your credentials"** - Ensure environment variables are set
2. **Network errors** - Check your internet connection
3. **401 Unauthorized** - Verify your credentials are correct
4. **Rate limiting** - The example includes automatic retry logic

## Learn More

- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)