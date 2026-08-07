/**
 * Streaming AI Responses in Real Time - TypeScript Entry Point
 *
 * Demonstrates SSE-based streaming from the Gloo AI completions API.
 * Shows token accumulation and typing-effect rendering.
 */

import "dotenv/config";
import { streamCompletion } from "./streaming/streamClient.js";
import { renderStreamToTerminal } from "./browser/renderer.js";

async function main(): Promise<void> {
  console.log("Streaming AI Responses in Real Time\n");

  const apiKey = process.env.GLOO_API_KEY;

  if (!apiKey) {
    console.error("Missing API key. Set GLOO_API_KEY in your .env file");
    process.exit(1);
  }

  console.log("Environment variables loaded\n");

  // --- Example 1: Accumulate full response ---
  console.log("Example: Streaming a completion (accumulate full text)...");
  const token = apiKey;
  const result = await streamCompletion(
    "What is the significance of the resurrection?",
    token
  );
  console.log(`\nFull response:\n${result.text}`);
  console.log(`\nReceived ${result.token_count} tokens in ${result.duration_ms}ms`);
  console.log(`  Finish reason: ${result.finish_reason}`);

  // --- Example 2: Typing-effect rendering ---
  console.log("\nExample: Typing-effect rendering...");
  await renderStreamToTerminal("Tell me about Christian discipleship.", token);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Fatal error:", message);
  process.exit(1);
});
