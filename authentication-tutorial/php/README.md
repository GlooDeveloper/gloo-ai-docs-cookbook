# Gloo AI Authentication Tutorial - PHP

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in PHP.

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

This will run a complete authentication test that:
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Token Management**: Automatic token refresh when expired
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

```php
<?php
require_once 'vendor/autoload.php';

// Include the authentication functions
require_once 'index.php';

function example() {
    // Get a valid token
    $token = ensureValidToken();
    
    // Make authenticated API calls
    $result = makeAuthenticatedRequest(
        "https://platform.ai.gloo.com/ai/v1/chat/completions",
        [
            'model' => 'us.anthropic.claude-sonnet-4-20250514-v1:0',
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