/**
 * Step 1 Test: Environment Setup & Auth Verification
 *
 * Validates that credentials load correctly and the streaming endpoint
 * responds with 200 OK and Content-Type: text/event-stream.
 *
 * Usage: node --loader ts-node/esm --no-warnings tests/step1-auth.test.ts
 */

import "dotenv/config";
import { getAccessToken, ensureValidToken } from "../src/auth/tokenManager.js";

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

async function testStep1(): Promise<void> {
  console.log("🧪 Testing Step 1: Environment Setup & Auth Verification\n");

  const clientId = process.env.GLOO_CLIENT_ID;
  const clientSecret = process.env.GLOO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Missing required environment variables");
    console.error("   Make sure .env file contains:");
    console.error("   - GLOO_CLIENT_ID");
    console.error("   - GLOO_CLIENT_SECRET");
    process.exit(1);
  }

  console.log("✓ GLOO_CLIENT_ID loaded");
  console.log("✓ GLOO_CLIENT_SECRET loaded\n");

  try {
    // Test 1: Get access token
    console.log("Test 1: Obtaining access token...");
    const tokenData = await getAccessToken();

    if (!tokenData.access_token) {
      throw new Error("Token response missing access_token field");
    }

    console.log("✓ Access token obtained");
    console.log(`  Expires in: ${tokenData.expires_in ?? "N/A"} seconds`);

    // Test 2: ensureValidToken caches correctly
    console.log("\nTest 2: Token caching (ensureValidToken)...");
    const token1 = await ensureValidToken();
    const token2 = await ensureValidToken();

    if (token1 !== token2) {
      throw new Error("ensureValidToken returned different tokens on consecutive calls");
    }

    console.log("✓ Token cached correctly — same token returned on consecutive calls");

    // Test 3: Verify streaming endpoint returns 200 + text/event-stream
    console.log("\nTest 3: Verifying streaming endpoint...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token1}`,
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

    console.log("✓ Status: 200 OK");
    console.log(`✓ Content-Type: ${contentType}`);

    await response.body?.cancel();

    console.log("\n✅ Step 1 Complete! Auth and streaming endpoint verified.");
    console.log("   Continue to Step 2: Making the Streaming Request\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Step 1 Test Failed");
    console.error(`Error: ${message}`);
    console.error("\n💡 Hints:");
    console.error("   - Check that .env has valid GLOO_CLIENT_ID and GLOO_CLIENT_SECRET");
    console.error("   - Verify credentials at https://platform.ai.gloo.com/studio/manage-api-credentials");
    console.error("   - Ensure you have internet connectivity\n");
    process.exit(1);
  }
}

testStep1();
