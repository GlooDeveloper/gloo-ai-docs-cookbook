# Completions with Tool Use - PHP

This example demonstrates how to use the Gloo AI Completions API with tool use to create structured output for predictable, machine-readable responses using PHP.

## Requirements

- PHP 8.1 or higher
- Composer
- cURL extension

## Setup

1. **Install dependencies using Composer:**
   ```bash
   composer install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in this directory:
   ```bash
   GLOO_API_KEY=your_api_key_here
   ```

   Or export it directly:
   ```bash
   export GLOO_API_KEY="your_api_key_here"
   ```

3. **Get your API key:**
   
   Obtain your API key from [Gloo AI Studio](https://studio.ai.gloo.com/api-keys).

## Running the Example

```bash
php index.php
```

## What it does

This script:
- Authenticates with the Gloo AI API using your API key
- Makes a completions API call with tool use
- Forces the AI to return structured data using the `create_growth_plan` tool
- Parses the JSON response and displays it in a user-friendly format
- Shows both formatted output and raw JSON

## Expected Output

The script will create a structured growth plan with a title and actionable steps, each with specific timelines.
