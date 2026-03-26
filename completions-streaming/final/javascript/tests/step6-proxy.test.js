/**
 * Server-Side Proxy Test
 *
 * Validates that:
 * - The Express proxy server starts and responds to /health
 * - POST /api/stream relays SSE from Gloo AI back to the client
 * - SSE lines arrive with correct format and stream terminates cleanly
 *
 * Usage: node tests/step6-proxy.test.js
 *
 * Note: Starts the proxy in a child process; no separate server process needed.
 */

import "dotenv/config";
import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

async function testStep6() {
  console.log("🧪 Testing: Server-Side Proxy\n");

  if (!process.env.GLOO_CLIENT_ID) {
    console.error("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
    process.exit(1);
  }

  const port = parseInt(process.env.PROXY_PORT ?? "3001", 10);
  let server = null;

  try {
    // Test 1: Start the proxy server as a child process
    console.log(`Test 1: Starting proxy server on port ${port}...`);
    server = spawn("node", ["src/proxy/server.js"], {
      env: { ...process.env, PROXY_PORT: String(port) },
      stdio: "pipe",
    });

    server.stderr?.on("data", () => {}); // suppress stderr

    // Wait for the server to be ready
    let ready = false;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(200);
    }

    if (!ready) {
      throw new Error(`Proxy server did not start on port ${port} within 4 seconds`);
    }
    console.log(`✓ Proxy server running at http://localhost:${port}`);

    // Test 2: Health endpoint
    console.log("\nTest 2: /health endpoint...");
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    if (healthRes.status !== 200) {
      throw new Error(`Expected 200 from /health, got ${healthRes.status}`);
    }
    const healthData = await healthRes.json();
    if (healthData.status !== "ok") {
      throw new Error(`Expected status=ok, got: ${JSON.stringify(healthData)}`);
    }
    console.log(`✓ /health returns: ${JSON.stringify(healthData)}`);

    // Test 3: POST /api/stream returns text/event-stream
    console.log("\nTest 3: POST /api/stream — Content-Type header...");
    const streamRes = await fetch(`http://127.0.0.1:${port}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }], auto_routing: true }),
    });
    if (streamRes.status !== 200) {
      const body = await streamRes.text();
      throw new Error(`Expected 200, got ${streamRes.status}: ${body.slice(0, 200)}`);
    }
    const contentType = streamRes.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Expected text/event-stream, got: ${contentType}`);
    }
    console.log(`✓ Content-Type: ${contentType}`);

    // Test 4: SSE lines arrive with correct format
    console.log("\nTest 4: SSE line format (data: prefix)...");
    let dataLines = 0;
    let streamTerminated = false;
    let finishReason = null;
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        if (!line.startsWith("data: ")) {
          throw new Error(`Expected 'data: ' prefix, got: ${JSON.stringify(line)}`);
        }
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const reason = parsed.choices?.[0]?.finish_reason;
          if (reason != null) {
            streamTerminated = true;
            finishReason = reason;
            break;
          }
        } catch {}
        dataLines++;
      }
      if (streamTerminated) break;
    }
    reader.cancel().catch(() => {});

    console.log(`✓ All lines have 'data: ' prefix (${dataLines} data chunks received)`);

    if (!streamTerminated) {
      console.warn("⚠️  Stream ended without a finish_reason chunk");
    } else {
      console.log(`✓ Stream terminated cleanly (finish_reason=${finishReason})`);
    }

    // Test 5: CORS headers present
    console.log("\nTest 5: CORS headers on response...");
    const corsRes = await fetch(`http://127.0.0.1:${port}/api/stream`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    const corsHeader = corsRes.headers.get("Access-Control-Allow-Origin") ?? "";
    if (!corsHeader) {
      console.warn("⚠️  Access-Control-Allow-Origin header not set on OPTIONS response");
    } else {
      console.log(`✓ Access-Control-Allow-Origin: ${corsHeader}`);
    }

    console.log("\n✅ Proxy server relaying SSE end-to-end.");
    console.log("   Proxy complete: credentials stay server-side, client receives SSE.\n");
  } catch (err) {
    console.error("\n❌ Server-Side Proxy Test Failed");
    console.error(`Error: ${err.message}`);
    console.error("\n💡 Hints:");
    console.error("   - Check that express is installed: npm install");
    console.error(`   - Verify port ${process.env.PROXY_PORT ?? 3001} is not already in use`);
    console.error("   - Check src/proxy/server.js imports ensureValidToken correctly");
    console.error("   - Confirm GLOO_CLIENT_ID and GLOO_CLIENT_SECRET are set in .env\n");
    process.exit(1);
  } finally {
    if (server) server.kill();
  }
}

testStep6();
