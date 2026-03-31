/**
 * Express SSE proxy server for streaming completions (TypeScript).
 *
 * Relays streaming requests from the browser to the Gloo AI API,
 * forwarding the SSE stream back to the client. This avoids exposing
 * API credentials in the browser.
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import { ensureValidToken } from "../auth/tokenManager.js";

const app = express();
app.use(express.json());

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
const CORS_ORIGIN = process.env.PROXY_CORS_ORIGIN ?? "http://localhost:3000";
const PORT = parseInt(process.env.PROXY_PORT ?? "3001", 10);

// CORS middleware
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

/**
 * Relay a streaming completion request to Gloo AI.
 */
app.post("/api/stream", async (req: Request, res: Response): Promise<void> => {
  // TODO: Implement the Express SSE proxy handler (Step 8):
  // 1. Set SSE response headers and retrieve the server-side auth token
  // 2. Build the upstream payload with stream set to true and send the POST request to the API
  // 3. Handle non-200 upstream responses by writing an error SSE frame and ending the response
  // 4. Set up a ReadableStream reader and loop to read, decode, and forward each chunk line by line
  // 5. Write each non-blank line as an SSE frame, handling errors and releasing the reader in finally
  throw new Error("Not implemented - see TODO comments");
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "completions-streaming-proxy" });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${CORS_ORIGIN}`);
});
