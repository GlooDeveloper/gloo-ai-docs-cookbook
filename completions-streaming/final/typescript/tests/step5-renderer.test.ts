/**
 * Step 7 Test: Typing-Effect Renderer
 *
 * Validates that renderStreamToTerminal() streams tokens to stdout
 * and prints a summary line with token count and finish_reason.
 *
 * Usage: node --loader ts-node/esm --no-warnings tests/step5-renderer.test.ts
 */

import "dotenv/config";
import { ensureValidToken } from "../src/auth/tokenManager.js";
import { renderStreamToTerminal } from "../src/browser/renderer.js";

async function testStep5(): Promise<void> {
  console.log("🧪 Testing Step 7: Typing-Effect Renderer\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  try {
    const token = await ensureValidToken();
    console.log("✓ Token obtained\n");

    // Capture stdout to verify output
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = (data: string) => {
      chunks.push(data);
      return origWrite(data);
    };

    console.log("Test 1: renderStreamToTerminal — streaming to terminal...");
    await renderStreamToTerminal("Reply with exactly: Hello streaming world", token);

    // Restore stdout
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = origWrite;

    const output = chunks.join("");

    if (!output.includes("Prompt:")) {
      throw new Error("Output missing 'Prompt:' header");
    }
    console.log("✓ Prompt header printed");

    if (!output.includes("Response:")) {
      throw new Error("Output missing 'Response:' label");
    }
    console.log("✓ Response label printed");

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

    console.log("\n✅ Step 7 Complete! Typing-effect renderer working.");
    console.log("   Continue to Steps 8–9: Server-Side Proxy\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Step 7 Test Failed");
    console.error(`Error: ${message}`);
    console.error("\n💡 Hints:");
    console.error("   - renderStreamToTerminal should use process.stdout.write for each token");
    console.error("   - Print '[N tokens, finish_reason=X]' summary at end");
    console.error("   - Check that the streaming loop correctly extracts token content\n");
    process.exit(1);
  }
}

testStep5();
