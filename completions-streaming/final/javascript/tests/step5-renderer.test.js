/**
 * Typing-Effect Renderer Test
 *
 * Validates that renderStreamToTerminal() streams tokens to stdout
 * and prints a summary line with token count and finish_reason.
 *
 * Usage: node tests/step5-renderer.test.js
 */

import "dotenv/config";
import { ensureValidToken } from "../src/auth/tokenManager.js";
import { renderStreamToTerminal } from "../src/browser/renderer.js";

async function testStep5() {
  console.log("🧪 Testing: Typing-Effect Renderer\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  try {
    const token = await ensureValidToken();
    console.log("✓ Token obtained\n");

    // Capture stdout to verify output
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (data) => {
      chunks.push(data);
      return origWrite(data);
    };

    console.log("Test 1: renderStreamToTerminal — streaming to terminal...");
    await renderStreamToTerminal("Reply with exactly: Hello streaming world", token);

    // Restore stdout
    process.stdout.write = origWrite;

    const output = chunks.join("");

    // Verify prompt header printed
    if (!output.includes("Prompt:")) {
      throw new Error("Output missing 'Prompt:' header");
    }
    console.log("✓ Prompt header printed");

    // Verify response appeared
    if (!output.includes("Response:")) {
      throw new Error("Output missing 'Response:' label");
    }
    console.log("✓ Response label printed");

    // Verify token summary at end
    const summaryMatch = output.match(/\[(\d+) tokens, finish_reason=(\w+)\]/);
    if (!summaryMatch) {
      throw new Error("Output missing token summary '[N tokens, finish_reason=X]'");
    }

    const tokenCount = parseInt(summaryMatch[1], 10);
    const finishReason = summaryMatch[2];

    if (tokenCount === 0) {
      throw new Error("token count is 0 — no tokens were streamed");
    }

    console.log(`✓ Token summary found: ${tokenCount} tokens, finish_reason=${finishReason}`);

    console.log("\n✅ Typing-effect renderer working.");
    console.log("   Next: Server-Side Proxy\n");
  } catch (err) {
    console.error("\n❌ Typing-Effect Renderer Test Failed");
    console.error(`Error: ${err.message}`);
    console.error("\n💡 Hints:");
    console.error("   - renderStreamToTerminal should use process.stdout.write for each token");
    console.error("   - Print '[N tokens, finish_reason=X]' summary at end");
    console.error("   - Check that the streaming loop correctly extracts token content\n");
    process.exit(1);
  }
}

testStep5();
