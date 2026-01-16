# Gloo AI Chat Message Tutorial - Python

This example demonstrates how to use the Gloo AI Message API to create interactive chat sessions using Python with modern best practices.

## Features

- ✅ OAuth2 authentication with automatic token refresh
- ✅ Type hints and dataclasses for better code quality
- ✅ Create new chat sessions
- ✅ Continue conversations with context
- ✅ Retrieve and display chat history
- ✅ Comprehensive error handling with custom exceptions
- ✅ Environment validation and configuration
- ✅ Formatted timestamp display
- ✅ Human flourishing conversation examples

## Prerequisites

- Python 3.9 or higher
- pip package manager
- Gloo AI API credentials (Client ID and Client Secret)

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

   Or install individually:
   ```bash
   pip install requests python-dotenv
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
python main.py
```

**Alternative:**
```bash
python3 main.py
```

**With virtual environment (recommended):**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Expected Output

The example will:
1. Validate environment variables
2. Authenticate with the Gloo AI API
3. Ask a deep question about finding meaning and purpose
4. Follow up with practical questions
5. Display the complete conversation history with formatted timestamps

## Code Structure

The example uses modern Python features:

### Data Classes
```python
@dataclass
class TokenInfo:
    access_token: str
    expires_in: int
    expires_at: int
    token_type: str

@dataclass
class MessageResponse:
    query_id: str
    message_id: str
    message: str
    timestamp: str
```

### Functions
- `get_access_token()` - Handles OAuth2 authentication
- `send_message()` - Sends messages to the chat API
- `get_chat_history()` - Retrieves conversation history
- `validate_environment()` - Validates required environment variables
- `display_message()` - Formats message display with timestamps
- `main()` - Demonstrates the complete flow

## Error Handling

The example includes comprehensive error handling:

### Custom Exception
```python
class GlooApiError(Exception):
    """Custom exception for Gloo AI API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)
```

### Error Types Handled
- Authentication failures
- API rate limits and network issues
- Invalid responses and timeouts
- Environment configuration errors
- Keyboard interrupts (Ctrl+C)

## API Endpoints Used

- `POST /oauth2/token` - Authentication
- `POST /ai/v1/message` - Send messages
- `GET /ai/v1/chat` - Retrieve chat history

## Python Features Used

- **Type Hints**: Full type annotations for better code quality
- **Dataclasses**: Clean data structure definitions
- **Optional Types**: Proper handling of nullable values
- **Context Managers**: Proper resource handling
- **Exception Handling**: Comprehensive error management
- **Environment Variables**: Secure configuration management
- **ISO Timestamp Parsing**: Proper datetime handling

## Customization

You can modify the conversation by:
- Changing the initial question
- Adding more follow-up questions
- Adjusting response parameters (character_limit, sources_limit)
- Filtering by publishers
- Modifying the dataclass definitions for extended functionality

## Virtual Environment (Recommended)

For better dependency management:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the example
python main.py

# Deactivate when done
deactivate
```

## Development

The code follows Python best practices:
- PEP 8 style guidelines
- Type hints for all functions
- Docstrings for all public functions
- Clear separation of concerns
- Proper error handling
- Resource management

## Troubleshooting

**Common issues:**

1. **"Please set your credentials"** - Ensure environment variables are set
2. **Import errors** - Install required packages with `pip install -r requirements.txt`
3. **Python version errors** - Ensure Python 3.9+ is installed
4. **Network errors** - Check your internet connection
5. **401 Unauthorized** - Verify your credentials are correct
6. **SSL errors** - Update your certificates or use Python 3.9+

## Learn More

- [Python Documentation](https://docs.python.org/3/)
- [Requests Library](https://requests.readthedocs.io/)
- [Gloo AI Documentation](https://docs.gloo.ai)
- [Message API Reference](https://docs.gloo.ai/api-reference/chat/post-message)
- [Authentication Guide](https://docs.gloo.ai/getting-started/authentication)