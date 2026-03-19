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

    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.trim()) {
          res.write(`${line}\n\n`);
        }
      }
    }

    reader.releaseLock();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: {"error": "${message}"}\n\n`);
  } finally {
    res.end();
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "completions-streaming-proxy" });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${CORS_ORIGIN}`);
});
