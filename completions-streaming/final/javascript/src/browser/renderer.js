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
  process.stdout.write(`Prompt: ${message}\n\nResponse: `);

  const response = await makeStreamingRequest(message, token);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let totalTokens = 0;
  let finishReason = "unknown";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseSseLine(line);
        if (chunk === null) continue;
        if (chunk === "[DONE]") break;

        const content = extractTokenContent(chunk);
        if (content) {
          process.stdout.write(content);
          totalTokens += 1;
        }

        const choices = chunk?.choices;
        if (choices && choices[0]?.finish_reason) {
          finishReason = choices[0].finish_reason;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  process.stdout.write(`\n\n[${totalTokens} tokens, finish_reason=${finishReason}]\n`);
}
