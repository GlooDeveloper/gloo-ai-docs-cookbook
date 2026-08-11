/**
 * Environment Setup & Auth Verification Test
 *
 * Validates that the API key loads correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * Usage: node --loader ts-node/esm --no-warnings tests/step1-auth.test.ts
 */

import "dotenv/config";

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

async function testStep1(): Promise<void> {
  console.log("Testing: Environment Setup & Auth Verification\n");

  const apiKey = process.env.GLOO_API_KEY;

  if (!apiKey) {
    console.error("Missing required environment variable");
    console.error("   Make sure .env file contains:");
    console.error("   - GLOO_API_KEY");
    process.exit(1);
  }

  console.log("API key loaded\n");

  try {
    // Test 1: Verify streaming endpoint returns 200 + text/event-stream
    console.log("Test 1: Verifying streaming endpoint...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hi" }],
        auto_routing: true,
        stream: true,
      }),
    });

    if (response.status !== 200) {
      const body = await response.text();
      throw new Error(`Expected 200, got ${response.status}: ${body.slice(0, 200)}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Expected Content-Type: text/event-stream, got: ${contentType}`);
    }

    console.log("Status: 200 OK");
    console.log(`Content-Type: ${contentType}`);

    await response.body?.cancel();

    console.log("\nAuth and streaming endpoint verified.");
    console.log("   Next: Making the Streaming Request\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\nAuth Test Failed");
    console.error(`Error: ${message}`);
    console.error("\nHints:");
    console.error("   - Check that .env has a valid GLOO_API_KEY");
    console.error("   - Get your API key at https://studio.ai.gloo.com/api-keys");
    console.error("   - Ensure you have internet connectivity\n");
    process.exit(1);
  }
}

testStep1();
