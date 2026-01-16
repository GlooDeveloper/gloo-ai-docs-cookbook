# Gloo AI Authentication Tutorial - TypeScript

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in TypeScript with full type safety.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```bash
   GLOO_CLIENT_ID=your_client_id_here
   GLOO_CLIENT_SECRET=your_client_secret_here
   ```

   Or export them directly:
   ```bash
   export GLOO_CLIENT_ID="your_client_id_here"
   export GLOO_CLIENT_SECRET="your_client_secret_here"
   ```

3. **Get your credentials:**
   
   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
npm start
```

Or to build and run:
```bash
npm run build
node dist/index.js
```

This will run a complete authentication test that:
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Full Type Safety**: Complete TypeScript types for all API interactions
- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management
- **Test Suite**: Built-in tests to verify authentication setup
- **Modular Design**: Exportable functions for use in other modules

## Type Definitions

The example includes comprehensive type definitions:

```typescript
interface TokenInfo {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
}

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}
```

## Expected Output

```
=== Gloo AI Authentication Test ===

1. Testing token retrieval...
   ✓ Token retrieved successfully
   Token type: Bearer
   Expires in: 3600 seconds

2. Testing token validation...
   ✓ Token validation successful

3. Testing authenticated API call...
   ✓ API call successful
   Response: Hello! I'm Claude, an AI assistant created by Anthropic...

=== All tests passed! ===
```

## Usage in Your Application

```typescript
import { ensureValidToken, makeAuthenticatedRequest, ChatCompletionRequest, ChatCompletionResponse } from './index.js';

async function example() {
    // Get a valid token
    const token = await ensureValidToken();
    
    // Make authenticated API calls with full type safety
    const request: ChatCompletionRequest = {
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        messages: [{ role: "user", content: "Your message here" }]
    };
    
    const result = await makeAuthenticatedRequest<ChatCompletionResponse>(
        "https://platform.ai.gloo.com/ai/v1/chat/completions",
        request
    );
    
    console.log(result.choices[0].message.content);
}
```

## Compilation

The TypeScript compiler is configured with strict mode enabled:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies
- **TypeScript errors**: Check your TypeScript version (requires 5.0+)