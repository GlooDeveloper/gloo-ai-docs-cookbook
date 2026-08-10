# Gloo AI Completions Tutorial - Python

This example demonstrates how to use the Gloo AI Completions API to generate text completions using the chat/completions endpoint.

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

This will run multiple completion tests that:
1. Make completion requests for different prompts
2. Display the generated responses

## Key Features

- **API Key Auth**: Simple API key authentication via Bearer token
- **Error Handling**: Comprehensive error handling for API failures
- **Environment Variables**: Secure credential management using python-dotenv
- **Multiple Tests**: Tests multiple completion scenarios
- **Python Best Practices**: Clean, readable code following PEP 8

## Dependencies

- `requests>=2.31.0`: HTTP client library
- `python-dotenv>=1.0.0`: Environment variable management

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

```python
from main import make_chat_completion_request

def example():
    # Make a completion request
    result = make_chat_completion_request("Your prompt here")
    
    # Extract the response
    response = result['choices'][0]['message']['content']
    print(response)
```

## Error Handling

The example includes comprehensive error handling for:
- Network connectivity issues
- Invalid credentials
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
