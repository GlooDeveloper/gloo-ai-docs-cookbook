# Gloo AI Chat Message Tutorial - JavaScript

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using JavaScript/Node.js.

## Features

- API key authentication
- Create new chat sessions
- Continue conversations with context
- Retrieve and display chat history
- Error handling and validation
- Human flourishing conversation examples

## Prerequisites

- Node.js 18 or higher
- npm package manager
- Gloo AI API key

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```env
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them in your shell:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

   You can get your API key from [https://studio.ai.gloo.com/api-keys](https://studio.ai.gloo.com/api-keys).

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
1. Authenticate with the Gloo AI API using your API key
2. Ask a deep question about finding meaning and purpose
3. Follow up with practical questions
4. Display the complete conversation history

## API Endpoints Used

- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Code Structure

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

1. **"Please set your GLOO_API_KEY"** - Ensure your API key environment variable is set
2. **Network errors** - Check your internet connection
3. **401 Unauthorized** - Verify your API key is correct
4. **Rate limiting** - The example includes automatic retry logic

## Learn More

- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)
