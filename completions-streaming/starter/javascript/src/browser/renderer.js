/**
 * CLI typing-effect renderer for streaming completions.
 *
 * Writes each token to stdout without newlines as it arrives, creating
 * a real-time typing effect in the terminal (Node.js).
 */

import { makeStreamingRequest, parseSseLine, extractTokenContent } from "../streaming/streamClient.js";

/**
 * Stream a completion and print tokens to stdout with a typing effect.
 *
 * Each content token is written immediately via process.stdout.write
 * so the user sees text appear token-by-token in the terminal.
 *
 * @param {string} message - The user message to send
 * @param {string} token - Valid Bearer token for authorization
 * @returns {Promise<void>}
 */
export async function renderStreamToTerminal(message, token) {
  // TODO: Implement the typing-effect terminal renderer (Step 7):
  // 1. Write the prompt: process.stdout.write(`Prompt: ${message}\n\nResponse: `)
  // 2. Call makeStreamingRequest(message, token) to open the stream
  // 3. Set up ReadableStream reader + TextDecoder + buffer string
  // 4. Loop: read chunks, split on "\n", parse with parseSseLine
  //    a. Skip null; break on "[DONE]"
  //    b. extractTokenContent — write immediately: process.stdout.write(content)
  //    c. Track totalTokens and finishReason
  // 5. Release reader lock in finally block
  // 6. Write summary: process.stdout.write(`\n\n[${totalTokens} tokens, finish_reason=${finishReason}]\n`)
  throw new Error("Not implemented - see TODO comments");
}
