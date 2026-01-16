# Gloo AI Completions Tutorial - TypeScript

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint in TypeScript with full type safety.

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

This will run multiple completion tests that:
1. Authenticate with the Gloo AI API
2. Make completion requests for different prompts
3. Display the generated responses

## Key Features

- **Full Type Safety**: Complete TypeScript types for all API interactions
- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for API failures
- **Environment Variables**: Secure credential management
- **Multiple Tests**: Tests multiple completion scenarios
- **Modular Design**: Exportable functions for use in other modules

## Dependencies

- `axios`: HTTP client library
- `dotenv`: Environment variable management

## Development Dependencies

- `@types/node`: Node.js type definitions
- `tsx`: TypeScript execution engine
- `typescript`: TypeScript compiler

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
=== Gloo AI Completions API Test ===

Test 1: How can I be joyful in hard times?
✓ Completion successful
Response: Finding joy during difficult times is a deeply human challenge that many people face...

Test 2: What are the benefits of a positive mindset?
✓ Completion successful
Response: A positive mindset can have profound effects on both mental and physical well-being...

Test 3: How do I build meaningful relationships?
✓ Completion successful
Response: Building meaningful relationships requires intentionality, authenticity, and consistent effort...

=== All completion tests passed! ===
```

## Usage in Your Application

```typescript
import { makeChatCompletionRequest, ensureValidToken, ChatCompletionResponse } from './index.js';

async function example() {
    // Make a completion request with full type safety
    const result: ChatCompletionResponse = await makeChatCompletionRequest("Your prompt here");
    
    // Extract the response
    const response = result.choices[0].message.content;
    console.log(response);
    
    // Or get a token for other API calls
    const token: string = await ensureValidToken();
    // Use token for other authenticated requests
}
```

## Authentication

This example uses the authentication methods from the [Authentication Tutorial](../../../tutorials/authentication). The token management is handled automatically, but you can also use the `ensureValidToken()` function to get a token for other API calls.

## Compilation

The TypeScript compiler is configured with strict mode enabled:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

## Error Handling

The example includes comprehensive error handling for:
- Network connectivity issues
- Invalid credentials
- Token expiration
- API rate limiting
- HTTP errors

All errors are properly typed and handled with TypeScript's type system.

## Node.js Version

This example requires Node.js 14 or higher.

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies
- **TypeScript errors**: Check your TypeScript version (requires 5.0+)
- **Build errors**: Run `npm run build` to compile TypeScript