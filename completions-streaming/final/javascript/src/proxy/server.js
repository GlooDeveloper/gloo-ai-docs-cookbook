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
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");

  try {
    const token = await ensureValidToken();
    const body = req.body ?? {};
    const payload = { ...body, stream: true };

    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.write(`data: {"error": "API error ${upstream.status}: ${errText.slice(0, 100)}"}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    // Pipe the upstream SSE stream to the client
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Forward each SSE line with double-newline delimiter
      for (const line of text.split("\n")) {
        if (line.trim()) {
          res.write(`${line}\n\n`);
        }
      }
    }

    reader.releaseLock();
  } catch (err) {
    res.write(`data: {"error": "${err.message}"}\n\n`);
  } finally {
    res.end();
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "completions-streaming-proxy" });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${CORS_ORIGIN}`);
});
