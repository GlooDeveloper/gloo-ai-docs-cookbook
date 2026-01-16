# Gloo AI Authentication Tutorial - JavaScript

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in JavaScript/Node.js.

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

This will run a complete authentication test that:
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management
- **Test Suite**: Built-in tests to verify authentication setup

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

```javascript
const { ensureValidToken, makeAuthenticatedRequest } = require('./index.js');

async function example() {
    // Get a valid token
    const token = await ensureValidToken();
    
    // Make authenticated API calls
    const result = await makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v1/chat/completions",
        {
            model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
            messages: [{ role: "user", content: "Your message here" }]
        }
    );
    
    console.log(result);
}
```

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies