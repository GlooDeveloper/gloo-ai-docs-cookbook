# Gloo AI Chat Message Tutorial - PHP

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using PHP with modern object-oriented practices.

## Features

- ✅ OAuth2 authentication with automatic token refresh
- ✅ Modern PHP 8.1+ features (typed properties, null coalescing)
- ✅ PSR-4 autoloading with Composer
- ✅ Create new chat sessions
- ✅ Continue conversations with context
- ✅ Retrieve and display chat history
- ✅ Comprehensive error handling with custom exceptions
- ✅ Environment validation and configuration
- ✅ Formatted timestamp display
- ✅ Human flourishing conversation examples

## Prerequisites

- PHP 8.1 or higher
- Composer package manager
- Gloo AI API credentials (Client ID and Client Secret)

## Setup

1. **Install dependencies:**
   ```bash
   composer install
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

**Basic usage:**
```bash
php index.php
```

**Make it executable:**
```bash
chmod +x index.php
./index.php
```

**With verbose output:**
```bash
php -d display_errors=On index.php
```

## Expected Output

The example will:
1. Validate environment variables
2. Authenticate with the Gloo AI API
3. Ask a deep question about finding meaning and purpose
4. Follow up with practical questions
5. Display the complete conversation history with formatted timestamps

## Code Structure

The example uses modern PHP features:

### Classes and Objects
```php
class TokenInfo {
    public string $access_token;
    public int $expires_in;
    public int $expires_at;
    public string $token_type;
    
    public function __construct(array $data) {
        $this->access_token = $data['access_token'];
        $this->expires_in = $data['expires_in'];
        $this->expires_at = time() + $data['expires_in'];
        $this->token_type = $data['token_type'];
    }
}
```

### Functions
- `getAccessToken()` - Handles OAuth2 authentication
- `sendMessage()` - Sends messages to the chat API
- `getChatHistory()` - Retrieves conversation history
- `validateEnvironment()` - Validates required environment variables
- `displayMessage()` - Formats message display with timestamps
- `main()` - Demonstrates the complete flow

## Error Handling

The example includes comprehensive error handling:

### Custom Exception
```php
class GlooApiException extends Exception {
    public ?int $status_code;
    
    public function __construct(string $message, ?int $status_code = null, ?Throwable $previous = null) {
        $this->status_code = $status_code;
        parent::__construct($message, $status_code ?? 0, $previous);
    }
}
```

### Error Types Handled
- Authentication failures
- API rate limits and network issues
- Invalid responses and timeouts
- Environment configuration errors
- JSON parsing errors

## Dependencies

The example uses these quality PHP packages:

- **Guzzle HTTP Client**: For making HTTP requests
- **phpdotenv**: For environment variable management
- **PHPUnit**: For testing (dev dependency)

## API Endpoints Used

- `POST /oauth2/token` - Authentication
- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## PHP Features Used

- **PHP 8.1+**: Modern syntax and features
- **Typed Properties**: Full type declarations
- **Null Coalescing**: Safe null handling
- **Arrow Functions**: Concise anonymous functions
- **Constructor Property Promotion**: Clean class definitions
- **Named Arguments**: Clear function calls
- **Union Types**: Flexible type declarations

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers
- Extending the classes for additional functionality

## Composer Scripts

You can add these scripts to your `composer.json`:

```json
{
    "scripts": {
        "start": "php index.php",
        "test": "phpunit",
        "check-syntax": "php -l index.php"
    }
}
```

Then run:
```bash
composer start
composer test
composer check-syntax
```

## Development Best Practices

The code follows PHP best practices:
- PSR-4 autoloading
- PSR-12 coding standards
- Type declarations for all properties and parameters
- Proper exception handling
- Clean separation of concerns
- Meaningful variable and function names

## Troubleshooting

**Common issues:**

1. **"Please set your credentials"** - Ensure environment variables are set
2. **Composer not found** - Install Composer from https://getcomposer.org/
3. **PHP version errors** - Ensure PHP 8.1+ is installed
4. **Network errors** - Check your internet connection and firewall
5. **401 Unauthorized** - Verify your credentials are correct
6. **SSL errors** - Update your CA certificates

**Debugging:**
```bash
# Check PHP version
php --version

# Validate syntax
php -l index.php

# Run with error reporting
php -d display_errors=On -d error_reporting=E_ALL index.php
```

## Learn More

- [PHP Documentation](https://www.php.net/docs.php)
- [Guzzle HTTP Client](https://docs.guzzlephp.org/)
- [Composer Documentation](https://getcomposer.org/doc/)
- [PSR Standards](https://www.php-fig.org/psr/)
- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)