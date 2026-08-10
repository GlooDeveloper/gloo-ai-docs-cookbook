# Grounded Completions Recipe - Python

This Python implementation demonstrates how to use Gloo AI's Grounded Completions API to reduce hallucinations through RAG (Retrieval-Augmented Generation).

## What This Does

Compares responses side-by-side:
- **Non-grounded**: Uses general model knowledge (may hallucinate)
- **Grounded**: Uses your actual content via RAG (accurate, source-backed)

## Prerequisites

- Python 3.7 or higher
- Gloo AI account with API key
- Publisher created in [Gloo Studio](https://studio.ai.gloo.com) with content uploaded

## Setup

1. **Create a virtual environment (recommended)**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env`** with your credentials:
   - `GLOO_API_KEY`: Your API key from [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)
   - `PUBLISHER_NAME`: Name of your Publisher (default: "Bezalel")

## Running the Demo

```bash
python main.py
```

The script will run 3 comparison queries showing the difference between grounded and non-grounded responses.

## Example Output

```
COMPARISON 1 of 3
================================================================================
Query: What is Bezalel Ministries' hiring process?
================================================================================

🔹 NON-GROUNDED Response (Generic Model Knowledge):
--------------------------------------------------------------------------------
[Generic response about typical hiring processes]

📊 Metadata:
   Sources used: False
   Model: gpt-4o

================================================================================

🔹 GROUNDED Response (From Your Content):
--------------------------------------------------------------------------------
[Accurate response with specific details from your content]

📊 Metadata:
   Sources used: True
   Model: gpt-4o
```

## How It Works

### Authentication
```python
# API key is read from environment and used directly as Bearer token
GLOO_API_KEY = os.getenv("GLOO_API_KEY")
headers = {"Authorization": f"Bearer {GLOO_API_KEY}"}
```

### Non-Grounded Request
```python
def make_non_grounded_request(query):
    """Standard completion WITHOUT RAG"""
    payload = {
        "messages": [{"role": "user", "content": query}],
        "auto_routing": True,
        "max_tokens": 500
    }
    # POST to /ai/v2/chat/completions
```

### Grounded Request
```python
def make_grounded_request(query, publisher_name, sources_limit=3):
    """Grounded completion WITH RAG"""
    payload = {
        "messages": [{"role": "user", "content": query}],
        "auto_routing": True,
        "rag_publisher": publisher_name,
        "sources_limit": sources_limit,
        "max_tokens": 500
    }
    # POST to /ai/v2/chat/completions/grounded
```

### Side-by-Side Comparison
```python
def compare_responses(query, publisher_name):
    """Compare both approaches for the same query"""
    # Makes both requests and displays results side-by-side
```

## Customization

### Use Your Own Content

1. Upload content to a Publisher in [Gloo Studio](https://studio.ai.gloo.com)
2. Update `PUBLISHER_NAME` in `.env` with your Publisher name
3. Modify the queries in `main()` to match your content

### Adjust Source Limits

```python
# Use more sources for complex queries
grounded = make_grounded_request(query, publisher_name, sources_limit=5)
```

### Add Custom Queries

```python
def main():
    queries = [
        "Your custom question here",
        "Another question about your content"
    ]
    for query in queries:
        compare_responses(query, PUBLISHER_NAME)
```

## Troubleshooting

### Authentication Errors
- Verify `GLOO_API_KEY` is correct
- Check your API key at [Gloo Studio API Keys](https://studio.ai.gloo.com/api-keys)

### Publisher Not Found
- Confirm publisher name matches exactly (case-sensitive)
- Verify publisher exists in [Gloo Studio](https://studio.ai.gloo.com)
- Ensure content is uploaded and indexed

### No Sources Returned
- Check that content is uploaded to the publisher
- Try increasing `sources_limit` parameter
- Verify query is relevant to uploaded content

## Learn More

- [Grounded Completions Recipe](https://docs.ai.gloo.com/tutorials/grounded-completions-recipe) - Full tutorial
- [Completions V2 API Guide](https://docs.ai.gloo.com/api-guides/completions-v2) - API documentation
- [Upload Content Tutorial](https://docs.ai.gloo.com/tutorials/upload-content) - Setting up Publishers
