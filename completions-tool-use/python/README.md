# Completions with Tool Use - Python

This example demonstrates how to use the Gloo AI Completions API with tool use to create structured output for predictable, machine-readable responses using Python.

## Requirements

- Python 3.9 or higher
- pip

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

## What it does

This script:
- Handles authentication with automatic token refresh
- Makes a completions API call with tool use
- Forces the AI to return structured data using the `create_growth_plan` tool
- Parses the JSON response and displays it in a user-friendly format
- Shows both formatted output and raw JSON

## Expected Output

The script will create a structured growth plan with a title and actionable steps, each with specific timelines.