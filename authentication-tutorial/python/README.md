# Gloo AI Authentication Tutorial - Python

This example demonstrates how to authenticate with the Gloo AI API using API key authentication in Python.

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
   GLOO_API_KEY=your_api_key_here
   ```

   Or export them directly:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

4. **Get your API key:**
   
   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Running the Example

```bash
python main.py
```

This will run a complete authentication test that:
1. Verifies the API key is configured
2. Makes an authenticated API call

## Key Features

- **API Key Auth**: Simple, direct authentication using an API key as a Bearer token
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

1. Verifying API key is configured...
   API key is set

2. Testing authenticated API call...
   API call successful
   Response: Hello! I'm ready when you are. How can I help you today?...

=== All tests passed! ===
```

## Usage in Your Application

```python
from main import make_authenticated_request

def example():
    # Make authenticated API calls
    result = make_authenticated_request(
        "https://platform.ai.gloo.com/ai/v2/chat/completions",
        {
            "auto_routing": True,
            "messages": [{"role": "user", "content": "Your message here"}]
        }
    )
    
    print(result)
```

## Error Handling

The example includes comprehensive error handling for:
- Network connectivity issues
- Invalid API key
- API rate limiting
- HTTP errors

## Python Version

This example requires Python 3.7 or higher.

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **403 Forbidden**: Verify your API access permissions
- **Network errors**: Ensure you have internet connectivity
- **Module not found**: Run `pip install -r requirements.txt`
- **SSL errors**: Update your certificates or use a newer Python version
