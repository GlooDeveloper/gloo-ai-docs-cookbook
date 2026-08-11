# Gloo AI Authentication Tutorial - PHP

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in PHP.

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
php index.php
```

Or using Composer:
```bash
composer start
```

This will run a complete authentication test that:
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management using vlucas/phpdotenv
- **Test Suite**: Built-in tests to verify authentication setup
- **PHP Standards**: Following PSR-12 coding standards

## Dependencies

- `vlucas/phpdotenv`: Environment variable management
- `ext-curl`: HTTP client functionality
- `ext-json`: JSON parsing

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

```php
<?php
require_once 'vendor/autoload.php';

// Include the authentication functions
require_once 'index.php';

function example() {
    // Make authenticated API calls
    $result = makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v2/chat/completions",
        [
            'auto_routing' => true,
            'messages' => [['role' => 'user', 'content' => 'Your message here']]
        ]
    );
    
    print_r($result);
}
?>
```

## Error Handling

The example includes comprehensive error handling for:
- cURL errors
- HTTP errors
- JSON parsing errors
- Network connectivity issues

## Security Features

- Environment variable management
- Proper error handling without exposing sensitive information
- Input validation

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **cURL errors**: Check your PHP cURL installation
- **Composer errors**: Run `composer install` to install dependencies
- **Extension missing**: Ensure cURL and JSON extensions are installed
