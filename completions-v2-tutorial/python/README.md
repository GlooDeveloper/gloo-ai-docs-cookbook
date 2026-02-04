# Gloo AI Completions V2 Tutorial - Python

This example demonstrates how to use the Gloo AI Completions V2 API with its three routing strategies: auto-routing, model family selection, and direct model selection.

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

4. **Get your credentials:**

   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
python main.py
```

## Key Features

- **Auto-Routing**: Let Gloo AI automatically select the optimal model based on query complexity
- **Model Family Selection**: Choose a provider family (anthropic, openai, google, open source)
- **Direct Model Selection**: Specify an exact model for full control
- **Token Management**: Automatic token refresh when expired
- **Tradition-Aware**: Optional theological perspective parameter

## V2 Routing Strategies

| Mode | Use Case | Parameter |
|------|----------|-----------|
| **AI Core** (Recommended) | Let Gloo AI automatically select the best model | `auto_routing: true` |
| **AI Core Select** | Choose a provider family, let Gloo pick the model | `model_family: "anthropic"` |
| **AI Select** | Specify an exact model | `model: "gloo-anthropic-claude-sonnet-4.5"` |

## Expected Output

```
=== Gloo AI Completions V2 API Test ===

Example 1: Auto-Routing
Testing: How does the Old Testament connect to the New Testament?
   Model used: gloo-openai-gpt-5.2
   Routing: auto_routing
   Response: The Old Testament and New Testament are one unified story...
   ✓ Auto-routing test passed

Example 2: Model Family Selection
Testing: Draft a short sermon outline on forgiveness.
   Model used: gloo-anthropic-claude-sonnet-4.5
   Response: # Sermon Outline: The Power of Forgiveness...
   ✓ Model family test passed

Example 3: Direct Model Selection
Testing: Summarize the book of Romans in 3 sentences.
   Model used: gloo-anthropic-claude-sonnet-4.5
   Response: Romans is Paul's theological masterpiece...
   ✓ Direct model test passed

=== All Completions V2 tests passed! ===
```

## Learn More

- [Completions V2 Tutorial](https://docs.gloo.com/tutorials/completions-v2)
- [Completions V2 API Guide](https://docs.gloo.com/api-guides/completions-v2)
- [Supported Models](https://docs.gloo.com/api-guides/supported-models)
