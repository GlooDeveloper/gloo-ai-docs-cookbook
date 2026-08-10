# Gloo AI Authentication Tutorial - JavaScript

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in JavaScript/Node.js.

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

This will run a complete authentication test that:
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management
- **Test Suite**: Built-in tests to verify authentication setup

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

```javascript
const { makeAuthenticatedRequest } = require('./index.js');

async function example() {
    // Make authenticated API calls
    const result = await makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v2/chat/completions",
        {
            auto_routing: true,
            messages: [{ role: "user", content: "Your message here" }]
        }
    );
    
    console.log(result);
}
```

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies
