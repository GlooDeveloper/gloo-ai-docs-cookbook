/**
 * Token Extraction & Full Response Assembly Test
 *
 * Validates that:
 * - extractTokenContent() safely navigates choices[0].delta.content
 * - streamCompletion() assembles the full text and tracks timing/count
 *
 * Usage: node tests/step3-accumulation.test.js
 */

import "dotenv/config";
import { ensureValidToken } from "../src/auth/tokenManager.js";
import { extractTokenContent, streamCompletion } from "../src/streaming/streamClient.js";

async function testStep3() {
  console.log("🧪 Testing: Token Extraction & Accumulation\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  try {
    // Test 1: extractTokenContent unit tests
    console.log("Test 1: extractTokenContent — normal chunk...");
    let chunk = { choices: [{ delta: { content: "Hello" }, finish_reason: null }] };
    let result = extractTokenContent(chunk);
    if (result !== "Hello") throw new Error(`Expected 'Hello', got ${JSON.stringify(result)}`);
    console.log("✓ Normal chunk → 'Hello'");

    console.log("Test 2: extractTokenContent — null content delta...");
    chunk = { choices: [{ delta: { content: null }, finish_reason: null }] };
    result = extractTokenContent(chunk);
    if (result !== "") throw new Error(`Expected '', got ${JSON.stringify(result)}`);
    console.log("✓ Null content → ''");

    console.log("Test 3: extractTokenContent — empty delta (role-only chunk)...");
    chunk = { choices: [{ delta: {}, finish_reason: null }] };
    result = extractTokenContent(chunk);
    if (result !== "") throw new Error(`Expected '', got ${JSON.stringify(result)}`);
    console.log("✓ Empty delta → ''");

    console.log("Test 4: extractTokenContent — no choices...");
    chunk = { choices: [] };
    result = extractTokenContent(chunk);
    if (result !== "") throw new Error(`Expected '', got ${JSON.stringify(result)}`);
    console.log("✓ Empty choices → ''");

    console.log("Test 5: extractTokenContent — finish_reason chunk...");
    chunk = { choices: [{ delta: {}, finish_reason: "stop" }] };
    result = extractTokenContent(chunk);
    if (result !== "") throw new Error(`Expected '', got ${JSON.stringify(result)}`);
    console.log("✓ finish_reason chunk → '' (no content from finish chunk)\n");

    // Test 6: Full streamCompletion integration test
    console.log("Test 6: streamCompletion — full response assembly...");
    const token = await ensureValidToken();
    const streamResult = await streamCompletion(
      "Count from 1 to 5, separated by spaces. Reply with only the numbers.",
      token
    );

    if (!streamResult || typeof streamResult !== "object") {
      throw new Error(`Expected object, got ${typeof streamResult}`);
    }
    if (!("text" in streamResult)) throw new Error("Missing 'text' key in result");
    if (!("token_count" in streamResult)) throw new Error("Missing 'token_count' key in result");
    if (!("duration_ms" in streamResult)) throw new Error("Missing 'duration_ms' key in result");
    if (!("finish_reason" in streamResult)) throw new Error("Missing 'finish_reason' key in result");

    console.log("✓ Delta content extraction working");
    console.log("✓ Null delta handled gracefully");
    console.log(`✓ finish_reason detected: ${streamResult.finish_reason}`);
    console.log(`✓ Duration tracked: ${streamResult.duration_ms}ms`);
    console.log(`✓ Token count: ${streamResult.token_count} tokens`);

    if (streamResult.text) {
      console.log(`  Response preview: ${JSON.stringify(streamResult.text.slice(0, 80).trim())}`);
    } else {
      console.log("⚠️  Empty response text — check accumulation loop");
    }

    if (streamResult.token_count === 0) {
      throw new Error("token_count is 0 — extractTokenContent may not be working");
    }
    if (streamResult.duration_ms <= 0) {
      throw new Error("duration_ms is 0 — timing not tracked");
    }

    console.log("\n✅ Full response assembled.");
    console.log("   Next: Typing-Effect Renderer\n");
  } catch (err) {
    console.error("\n❌ Token Extraction & Accumulation Test Failed");
    console.error(`Error: ${err.message}`);
    console.error("\n💡 Hints:");
    console.error("   - extractTokenContent: use chunk?.choices?.[0]?.delta?.content pattern");
    console.error("   - content || '' handles null/undefined correctly");
    console.error("   - streamCompletion: increment token_count only when content is non-empty");
    console.error("   - Capture startTime = Date.now() before the request\n");
    process.exit(1);
  }
}

testStep3();
