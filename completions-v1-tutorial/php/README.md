# Gloo AI Completions Tutorial - PHP

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint in PHP.

## Requirements

- PHP 8.1 or higher
- cURL extension
- JSON extension
- Composer

## Setup

1. **Install dependencies:**
   ```bash
   composer install
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
php index.php
```

Or using Composer:
```bash
composer start
```

This will run multiple completion tests that:
1. Authenticate with the Gloo AI API
2. Make completion requests for different prompts
3. Display the generated responses

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for API failures
- **Environment Variables**: Secure credential management using vlucas/phpdotenv
- **Multiple Tests**: Tests multiple completion scenarios
- **PHP Standards**: Following PSR-12 coding standards

## Dependencies

- `vlucas/phpdotenv`: Environment variable management
- `ext-curl`: HTTP client functionality
- `ext-json`: JSON parsing

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

```php
<?php
require_once 'vendor/autoload.php';

// Include the completions functions
require_once 'index.php';

function example() {
    // Make a completion request
    $result = makeChatCompletionRequest("Your prompt here");
    
    // Extract the response
    $response = $result['choices'][0]['message']['content'];
    echo $response;
    
    // Or get a token for other API calls
    $token = ensureValidToken();
    // Use token for other authenticated requests
}
?>
```

## Authentication

This example uses the authentication methods from the [Authentication Tutorial](../../../tutorials/authentication). The token management is handled automatically, but you can also use the `ensureValidToken()` function to get a token for other API calls.

## Error Handling

The example includes comprehensive error handling for:
- cURL errors
- HTTP errors
- JSON parsing errors
- Token expiration
- Network connectivity issues

## Security Features

- Environment variable management
- Secure token storage
- Proper error handling without exposing sensitive information
- Input validation

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **cURL errors**: Check your PHP cURL installation
- **Composer errors**: Run `composer install` to install dependencies
- **Extension missing**: Ensure cURL and JSON extensions are installed