# Completions with Tool Use - Java

This example demonstrates how to use the Gloo AI Completions API with tool use to create structured output for predictable, machine-readable responses using Java.

## Requirements

- Java 17 or higher
- Maven 3.6 or higher

## Setup

1. **Compile the project using Maven:**
   ```bash
   mvn compile
   ```

2. **Set up environment variables:**
   
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

3. **Get your credentials:**
   
   Obtain your Client ID and Client Secret from API Credentials in [Gloo AI Studio](https://studio.ai.gloo.com/).

## Running the Example

```bash
mvn exec:java
```

Alternatively, you can compile and run manually:
```bash
mvn compile exec:java -Dexec.mainClass="com.gloo.completionstooluse.Main"
```

## Dependencies

- `com.google.code.gson:gson`: JSON parsing and generation
- `io.github.cdimascio:dotenv-java`: Environment variable management

## What it does

This script:
- Handles authentication with automatic token refresh
- Makes a completions API call with tool use
- Forces the AI to return structured data using the `create_growth_plan` tool
- Parses the JSON response and displays it in a user-friendly format
- Shows both formatted output and raw JSON

## Expected Output

The script will create a structured growth plan with a title and actionable steps, each with specific timelines.