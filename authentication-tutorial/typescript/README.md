# Gloo AI Authentication Tutorial - TypeScript

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in TypeScript with full type safety.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```bash
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them directly:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

3. **Get your API key:**
   
   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

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
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **Full Type Safety**: Complete TypeScript types for all API interactions
- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management
- **Test Suite**: Built-in tests to verify authentication setup
- **Modular Design**: Exportable functions for use in other modules

## Type Definitions

The example includes comprehensive type definitions:

```typescript
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    auto_routing: boolean;
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

1. Verifying API key is configured...
   API key is set

2. Testing authenticated API call...
   API call successful
   Response: Hello! I'm ready when you are. How can I help you today?...

=== All tests passed! ===
```

## Usage in Your Application

```typescript
import { makeAuthenticatedRequest, ChatCompletionRequest, ChatCompletionResponse } from './index.js';

async function example() {
    // Make authenticated API calls with full type safety
    const request: ChatCompletionRequest = {
        auto_routing: true,
        messages: [{ role: "user", content: "Your message here" }]
    };

    const result = await makeAuthenticatedRequest<ChatCompletionResponse>(
        "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions",
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

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies
- **TypeScript errors**: Check your TypeScript version (requires 5.0+)
