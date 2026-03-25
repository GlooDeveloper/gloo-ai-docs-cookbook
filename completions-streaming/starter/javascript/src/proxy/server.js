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
  // 1. Set SSE response headers and retrieve the server-side auth token
  // 2. Build the upstream payload with stream set to true and send the POST request to the API
  // 3. Handle non-200 upstream responses by writing an error SSE frame and ending the response
  // 4. Set up a ReadableStream reader and loop to read, decode, and forward each chunk line by line
  // 5. Write each non-blank line as an SSE frame, handling errors and releasing the reader in finally
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
