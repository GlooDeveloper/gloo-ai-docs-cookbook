/**
 * Express SSE proxy server for streaming completions.
 *
 * Relays streaming requests from the browser to the Gloo AI API,
 * forwarding the SSE stream back to the client. This avoids exposing
 * API credentials in the browser.
 */

import "dotenv/config";
import express from "express";
import { ensureValidToken } from "../auth/tokenManager.js";

const app = express();
app.use(express.json());

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
const CORS_ORIGIN = process.env.PROXY_CORS_ORIGIN ?? "http://localhost:3000";
const PORT = parseInt(process.env.PROXY_PORT ?? "3001", 10);

// CORS middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

/**
 * Relay a streaming completion request to Gloo AI.
 *
 * Accepts a JSON body with at minimum a `messages` array. Injects
 * `stream: true` and forwards the SSE response back to the caller
 * with the correct event-stream headers.
 */
app.post("/api/stream", async (req, res) => {
  // TODO: Implement the Express SSE proxy handler (Step 8):
  // 1. Set SSE response headers: Content-Type: text/event-stream, Cache-Control: no-cache,
  //    X-Accel-Buffering: no, Connection: keep-alive
  // 2. Call ensureValidToken() to get the server-side auth token
  // 3. Build payload: { ...req.body, stream: true }
  // 4. fetch(API_URL, { method: "POST", headers: { Authorization: `Bearer ${token}`, ... }, body: JSON.stringify(payload) })
  // 5. If !upstream.ok: write SSE error frame and call res.end(); return
  // 6. Set up upstream.body.getReader() + TextDecoder
  // 7. Loop: read chunks, decode, split on "\n", for non-blank lines: res.write(`${line}\n\n`)
  // 8. Call reader.releaseLock() after loop
  // 9. Wrap in try/catch to write SSE error frames; call res.end() in finally
  res.write('data: {"error": "Not implemented - see TODO comments"}\n\n');
  res.end();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "completions-streaming-proxy" });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${CORS_ORIGIN}`);
});
