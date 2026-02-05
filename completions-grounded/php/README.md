# Grounded Completions Recipe - PHP

This PHP implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- PHP 7.4 or higher
- Composer
- cURL extension enabled
- JSON extension enabled
- Gloo AI account with API credentials
- Publisher created in [Gloo Studio](https://studio.ai.gloo.com) with content uploaded

## Setup

1. **Install dependencies**:
   ```bash
   composer install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** with your credentials:
   - `GLOO_CLIENT_ID`: Your Client ID from [Studio Settings](https://studio.ai.gloo.com/settings/api-keys)
   - `GLOO_CLIENT_SECRET`: Your Client Secret
   - `PUBLISHER_NAME`: Name of your Publisher (default: "Bezalel")

## Running the Demo

```bash
php index.php
# or
composer start
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## How It Works

### Token Management
```php
function getAccessToken() {
    // Retrieve OAuth2 access token from Gloo AI
    // Exchanges client credentials for access token
}

function ensureValidToken() {
    // Ensure we have a valid token, refreshing if needed
    // Checks expiration and refreshes automatically
}
```

### Non-Grounded Request
```php
function makeNonGroundedRequest($query) {
    // Standard completion WITHOUT RAG
    $payload = [
        'messages' => [['role' => 'user', 'content' => $query]],
        'auto_routing' => true,
        'max_tokens' => 500
    ];
    // POST to /ai/v2/chat/completions using cURL
}
```

### Grounded Request
```php
function makeGroundedRequest($query, $publisherName, $sourcesLimit = 3) {
    // Grounded completion WITH RAG
    $payload = [
        'messages' => [['role' => 'user', 'content' => $query]],
        'auto_routing' => true,
        'rag_publisher' => $publisherName,
        'sources_limit' => $sourcesLimit,
        'max_tokens' => 500
    ];
    // POST to /ai/v2/chat/completions/grounded using cURL
}
```

### Side-by-Side Comparison
```php
function compareResponses($query, $publisherName) {
    // Compare both approaches for the same query
    // Makes both requests and displays results side-by-side
}
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```php
// Use more sources for complex queries
$grounded = makeGroundedRequest($query, $publisherName, 5);
```

### Add Custom Queries

```php
function main() {
    global $publisherName;

    $queries = [
        "Your custom question here",
        "Another question about your content"
    ];

    foreach ($queries as $query) {
        compareResponses($query, $publisherName);
    }
}
```

### Use in Your Application

```php
require_once __DIR__ . '/vendor/autoload.php';

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Make a grounded request
$result = makeGroundedRequest(
    "Your query",
    "YourPublisher",
    3
);

echo $result['choices'][0]['message']['content'];
```

## Troubleshooting

### Composer Errors
```bash
composer install --no-cache
```

### cURL Extension Missing
```bash
# Ubuntu/Debian
sudo apt-get install php-curl

# macOS
# cURL is usually included by default

# Verify
php -m | grep curl
```

### Authentication Errors
- Verify `GLOO_CLIENT_ID` and `GLOO_CLIENT_SECRET` are correct
- Check credentials at [Studio Settings](https://studio.ai.gloo.com/settings/api-keys)

### Publisher Not Found
- Confirm publisher name matches exactly (case-sensitive)
- Verify publisher exists in [Gloo Studio](https://studio.ai.gloo.com)
- Ensure content is uploaded and indexed

### No Sources Returned
- Check that content is uploaded to the publisher
- Try increasing `$sourcesLimit` parameter
- Verify query is relevant to uploaded content

### SSL Certificate Errors
If you encounter SSL errors, you may need to update your CA certificates:
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ca-certificates
```

## Learn More

- [Grounded Completions Recipe](https://docs.ai.gloo.com/tutorials/grounded-completions-recipe) - Full tutorial
- [Completions V2 API Guide](https://docs.ai.gloo.com/api-guides/completions-v2) - API documentation
- [Upload Content Tutorial](https://docs.ai.gloo.com/tutorials/upload-content) - Setting up Publishers
