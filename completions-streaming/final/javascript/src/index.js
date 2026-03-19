/**
 * Streaming AI Responses in Real Time - JavaScript Entry Point
 *
 * Demonstrates SSE-based streaming from the Gloo AI completions API.
 * Shows token accumulation and typing-effect rendering.
 */

import "dotenv/config";
import { ensureValidToken } from "./auth/tokenManager.js";
import { streamCompletion } from "./streaming/streamClient.js";
import { renderStreamToTerminal } from "./browser/renderer.js";

async function main() {
  console.log("Streaming AI Responses in Real Time\n");

  const clientId = process.env.GLOO_CLIENT_ID;
  const clientSecret = process.env.GLOO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET");
    process.exit(1);
  }

  console.log("Environment variables loaded\n");

  // --- Example 1: Accumulate full response ---
  console.log("Example: Streaming a completion (accumulate full text)...");
  const token = await ensureValidToken();
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

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
