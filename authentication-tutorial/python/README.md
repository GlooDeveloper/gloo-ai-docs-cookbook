# Gloo AI Authentication Tutorial - Python

This example demonstrates how to authenticate with the Gloo AI API using OAuth2 client credentials flow in Python.

## Setup

1. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   
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

4. **Get your credentials:**
   
   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
python main.py
```

This will run a complete authentication test that:
1. Retrieves an access token
2. Validates token management
3. Makes an authenticated API call

## Key Features

- **Token Management**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling for authentication failures
- **Environment Variables**: Secure credential management using python-dotenv
- **Test Suite**: Built-in tests to verify authentication setup
- **Python Best Practices**: Clean, readable code following PEP 8

## Dependencies

- `requests>=2.31.0`: HTTP client library
- `python-dotenv>=1.0.0`: Environment variable management

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

```python
from main import ensure_valid_token, make_authenticated_request

def example():
    # Get a valid token
    token = ensure_valid_token()
    
    # Make authenticated API calls
    result = make_authenticated_request(
        "https://platform.ai.gloo.com/ai/v1/chat/completions",
        {
            "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
            "messages": [{"role": "user", "content": "Your message here"}]
        }
    )
    
    print(result)
```

## Error Handling

The example includes comprehensive error handling for:
- Network connectivity issues
- Invalid credentials
- Token expiration
- API rate limiting
- HTTP errors

## Python Version

This example requires Python 3.7 or higher.

## Troubleshooting

- **401 Unauthorized**: Check your Client ID and Client Secret
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `pip install -r requirements.txt`
- **SSL errors**: Update your certificates or use a newer Python version