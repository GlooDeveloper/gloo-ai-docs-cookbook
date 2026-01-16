# Gloo AI Chat Message Tutorial - TypeScript

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using TypeScript with full type safety.

## Features

- ✅ OAuth2 authentication with automatic token refresh
- ✅ Full TypeScript type definitions for all API responses
- ✅ Create new chat sessions with type safety
- ✅ Continue conversations with context
- ✅ Retrieve and display chat history
- ✅ Comprehensive error handling with custom error types
- ✅ Environment validation
- ✅ Human flourishing conversation examples

## Prerequisites

- Node.js 18 or higher
- npm package manager
- TypeScript knowledge
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

**Development mode (with ts-node):**
```bash
npm run dev
```

**Production mode (compiled):**
```bash
npm start
```

**Build only:**
```bash
npm run build
```

## Expected Output

The example will:
1. Validate environment variables
2. Authenticate with the Gloo AI API
3. Ask a deep question about finding meaning and purpose
4. Follow up with practical questions
5. Display the complete conversation history with timestamps

## Type Definitions

The example includes comprehensive TypeScript interfaces:

```typescript
interface TokenInfo {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
}

interface MessageResponse {
    query_id: string;
    message_id: string;
    message: string;
    timestamp: string;
}

interface ChatMessage {
    query_id: string;
    message_id: string;
    timestamp: string;
    role: 'user' | 'kallm';
    message: string;
    character_limit?: number;
}

interface ChatHistory {
    chat_id: string;
    created_at: string;
    messages: ChatMessage[];
}
```

## API Endpoints Used

- `POST /oauth2/token` - Authentication
- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Code Structure

- `getAccessToken()` - Handles OAuth2 authentication with type safety
- `sendMessage()` - Sends messages with proper request/response types
- `getChatHistory()` - Retrieves conversation history with full typing
- `validateEnvironment()` - Validates required environment variables
- `displayMessage()` - Formats message display with timestamps
- `main()` - Demonstrates the complete flow

## Error Handling

The example includes comprehensive error handling for:
- Authentication failures with detailed error messages
- API rate limits and network issues
- Type validation errors
- Environment configuration issues

## TypeScript Features Used

- **Strict Mode**: Full TypeScript strict mode enabled
- **Interface Definitions**: Complete type definitions for all API responses
- **Generic Types**: Proper use of Axios generic types
- **Optional Properties**: Proper handling of optional API parameters
- **Union Types**: Role types defined as union of string literals
- **Type Guards**: Safe type checking throughout the code

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers
- Adding new interface properties for extended functionality

## Development

The TypeScript configuration includes:
- ES2022 target for modern JavaScript features
- Strict type checking enabled
- Source maps for debugging
- Declaration files for library usage

## Troubleshooting

**Common issues:**

1. **TypeScript compilation errors** - Check your tsconfig.json settings
2. **"Please set your credentials"** - Ensure environment variables are set
3. **Type errors** - All API responses are fully typed; check interface definitions
4. **Network errors** - Check your internet connection
5. **401 Unauthorized** - Verify your credentials are correct

## Learn More

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)