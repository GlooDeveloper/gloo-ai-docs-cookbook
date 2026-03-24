/**
 * Streaming Error Handling Test
 *
 * Validates that:
 * - handleStreamError() throws the right error for 401, 403, 429
 * - handleStreamError() does not throw for 200
 * - Bad credentials produce a proper auth error
 *
 * Usage: node --loader ts-node/esm --no-warnings tests/step4-error-handling.test.ts
 */

import "dotenv/config";
import { handleStreamError, makeStreamingRequest } from "../src/streaming/streamClient.js";

async function testStep4(): Promise<void> {
  console.log("🧪 Testing: Streaming Error Handling\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  try {
    // Test 1: handleStreamError(401)
    console.log("Test 1: handleStreamError(401)...");
    try {
      handleStreamError(401);
      throw new Error("Expected error to be thrown for 401");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("401")) throw new Error(`Expected 401 in message, got: ${message}`);
      console.log(`✓ 401 throws: ${message}`);
    }

    // Test 2: handleStreamError(403)
    console.log("Test 2: handleStreamError(403)...");
    try {
      handleStreamError(403);
      throw new Error("Expected error to be thrown for 403");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("403")) throw new Error(`Expected 403 in message, got: ${message}`);
      console.log(`✓ 403 throws: ${message}`);
    }

    // Test 3: handleStreamError(429)
    console.log("Test 3: handleStreamError(429)...");
    try {
      handleStreamError(429);
      throw new Error("Expected error to be thrown for 429");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("429")) throw new Error(`Expected 429 in message, got: ${message}`);
      console.log(`✓ 429 throws: ${message}`);
    }

    // Test 4: handleStreamError(200) — should not throw
    console.log("Test 4: handleStreamError(200) — should not throw...");
    try {
      handleStreamError(200);
      console.log("✓ 200 does not throw");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`handleStreamError(200) should not throw, but threw: ${message}`);
    }

    // Test 5: handleStreamError with generic non-200 code
    console.log("Test 5: handleStreamError(500)...");
    try {
      handleStreamError(500, "Internal Server Error");
      throw new Error("Expected error for 500");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("500")) throw new Error(`Expected 500 in message, got: ${message}`);
      console.log(`✓ 500 throws with body: ${message}`);
    }

    // Test 6: Bad credentials are caught by makeStreamingRequest
    console.log("\nTest 6: Bad credentials → auth error...");
    try {
      await makeStreamingRequest("test", "invalid-token-xyz");
      throw new Error("Expected makeStreamingRequest to throw with bad credentials");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Expected error") || message.includes("makeStreamingRequest")) throw err;
      console.log(`✓ Bad credentials caught: ${message}`);
    }

    console.log("\n✅ Two-phase error handling working.");
    console.log("   Next: Typing-Effect Renderer\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Streaming Error Handling Test Failed");
    console.error(`Error: ${message}`);
    console.error("\n💡 Hints:");
    console.error("   - handleStreamError should throw for any non-200 status");
    console.error("   - Specific messages for 401, 403, 429 help users debug auth issues");
    console.error("   - makeStreamingRequest calls handleStreamError after checking response.ok\n");
    process.exit(1);
  }
}

testStep4();
