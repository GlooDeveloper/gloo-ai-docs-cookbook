# Gloo AI Completions Tutorial - JavaScript

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint in JavaScript/Node.js.

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

This will run multiple completion tests that:
1. Make completion requests for different prompts
2. Display the generated responses

## Key Features

- **API Key Auth**: Simple API key authentication via Bearer token
- **Error Handling**: Comprehensive error handling for API failures
- **Environment Variables**: Secure credential management
- **Multiple Tests**: Tests multiple completion scenarios
- **Modular Design**: Exportable functions for use in other modules

## Dependencies

- `axios`: HTTP client library
- `dotenv`: Environment variable management

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

```javascript
const { makeChatCompletionRequest } = require('./index.js');

async function example() {
    // Make a completion request
    const result = await makeChatCompletionRequest("Your prompt here");
    
    // Extract the response
    const response = result.choices[0].message.content;
    console.log(response);
}
```

## Error Handling

The example includes comprehensive error handling for:
- Network connectivity issues
- Invalid credentials
- API rate limiting
- HTTP errors

## Node.js Version

This example requires Node.js 14 or higher.

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `npm install` to install dependencies
- **EACCES errors**: Check file permissions
