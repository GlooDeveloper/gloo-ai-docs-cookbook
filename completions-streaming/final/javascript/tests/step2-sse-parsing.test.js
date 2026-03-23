/**
 * Streaming Request & SSE Line Parsing Test
 *
 * Validates that:
 * - makeStreamingRequest() opens a streaming connection
 * - parseSseLine() correctly parses data lines, blank lines, and [DONE]
 *
 * Usage: node tests/step2-sse-parsing.test.js
 */

import "dotenv/config";
import { ensureValidToken } from "../src/auth/tokenManager.js";
import { makeStreamingRequest, parseSseLine } from "../src/streaming/streamClient.js";

async function testStep2() {
  console.log("🧪 Testing: Streaming Request & SSE Line Parsing\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  try {
    const token = await ensureValidToken();
    console.log("✓ Token obtained\n");

    // Test 1: parseSseLine unit tests (no network needed)
    console.log("Test 1: parseSseLine — blank line...");
    let result = parseSseLine("");
    if (result !== null) throw new Error(`Expected null for blank line, got ${JSON.stringify(result)}`);
    console.log("✓ Blank line → null");

    console.log("Test 2: parseSseLine — non-data line...");
    result = parseSseLine("event: message");
    if (result !== null) throw new Error(`Expected null for non-data line, got ${JSON.stringify(result)}`);
    console.log("✓ Non-data line → null");

    console.log("Test 3: parseSseLine — [DONE] sentinel...");
    result = parseSseLine("data: [DONE]");
    if (result !== "[DONE]") throw new Error(`Expected '[DONE]', got ${JSON.stringify(result)}`);
    console.log("✓ data: [DONE] → '[DONE]'");

    console.log("Test 4: parseSseLine — valid JSON data line...");
    const sample = 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}';
    result = parseSseLine(sample);
    if (!result || typeof result !== "object") throw new Error(`Expected object, got ${typeof result}`);
    if (result.choices[0].delta.content !== "Hello") throw new Error("Unexpected content value");
    console.log("✓ data: {json} → parsed object");

    console.log("Test 5: parseSseLine — malformed JSON...");
    result = parseSseLine("data: {broken json");
    if (result !== null) throw new Error(`Expected null for malformed JSON, got ${JSON.stringify(result)}`);
    console.log("✓ Malformed JSON → null (gracefully handled)\n");

    // Test 6: Live streaming connection
    console.log("Test 6: makeStreamingRequest() — live connection...");
    const response = await makeStreamingRequest("Say exactly: 'Stream test OK'", token);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    console.log("✓ Streaming connection opened (status 200)");

    // Test 7: Iterate chunks and detect stream termination via finish_reason
    console.log("Test 7: Iterating SSE lines and detecting stream termination...");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let linesProcessed = 0;
    let dataChunks = 0;
    let streamTerminated = false;
    let finishReason = null;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        linesProcessed++;
        const chunk = parseSseLine(line);
        if (chunk && typeof chunk === "object") {
          const reason = chunk.choices?.[0]?.finish_reason;
          if (reason != null) { streamTerminated = true; finishReason = reason; break outer; }
          dataChunks++;
        }
      }
    }
    reader.releaseLock();

    console.log(`✓ Processed ${linesProcessed} lines, ${dataChunks} data chunks`);

    if (!streamTerminated) {
      console.log("⚠️  Stream ended without a finish_reason chunk");
    } else {
      console.log(`✓ Stream terminated cleanly (finish_reason=${finishReason})`);
    }

    console.log("\n✅ Streaming request and SSE parsing working.");
    console.log("   Next: Extracting Token Content\n");
  } catch (err) {
    console.error("\n❌ Streaming Request & SSE Parsing Test Failed");
    console.error(`Error: ${err.message}`);
    console.error("\n💡 Hints:");
    console.error("   - Check makeStreamingRequest() sets stream:true in the payload");
    console.error("   - Check parseSseLine() strips 'data: ' prefix (6 chars with slice(6))");
    console.error("   - Verify [DONE] check: data.trim() === '[DONE]'\n");
    process.exit(1);
  }
}

testStep2();
