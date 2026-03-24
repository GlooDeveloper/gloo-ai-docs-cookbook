/**
 * Streaming client for Gloo AI completions API.
 *
 * Implements SSE parsing, token extraction, and accumulation loop for
 * real-time streaming responses using the fetch API with ReadableStream.
 */

import type { SSEChunk, StreamResult } from "../types.js";

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

/**
 * Check HTTP status before reading stream and throw specific errors.
 *
 * @param statusCode - HTTP status code
 * @param responseBody - Response body for generic errors
 * @throws Error with a descriptive message for 401, 403, 429, and other errors
 */
export function handleStreamError(statusCode: number, responseBody = ""): void {
  // TODO: Check statusCode and throw specific errors (Step 6):
  // 1. statusCode === 401: throw new Error("Authentication failed (401): Invalid or expired token")
  // 2. statusCode === 403: throw new Error("Authorization failed (403): Insufficient permissions")
  // 3. statusCode === 429: throw new Error("Rate limit exceeded (429): Too many requests")
  // 4. statusCode !== 200: throw new Error(`API error (${statusCode}): ${String(responseBody).slice(0, 200)}`)
  // Do NOT throw for statusCode === 200 — that is a successful response.
  throw new Error("Not implemented - see TODO comments");
}

/**
 * POST to the completions API with stream:true and return the raw Response.
 *
 * @param message - The user message to send
 * @param token - Valid Bearer token for authorization
 * @returns Raw fetch Response with streaming body
 * @throws Error if the server returns a non-200 status
 */
export async function makeStreamingRequest(message: string, token: string): Promise<Response> {
  // TODO: Make a streaming POST request to the completions API (Step 2):
  // 1. Call fetch(API_URL, { method: "POST", headers: { Authorization: `Bearer ${token}`, ... }, body: JSON.stringify({...}) })
  // 2. Include in the body: messages, auto_routing: true, stream: true
  // 3. If !response.ok: read body text and call handleStreamError(response.status, body)
  // 4. Return the raw Response object
  throw new Error("Not implemented - see TODO comments");
}

/**
 * Parse one SSE text line from the stream.
 *
 * SSE lines follow the format `data: <json-payload>`. The stream ends when a chunk
 * arrives with a non-null `choices[0].finish_reason` (e.g. "stop"). A `[DONE]`
 * sentinel is handled for compatibility but is not sent by the Gloo AI API.
 *
 * @param line - Raw text line from the SSE stream
 * @returns null for blank/non-data lines, '[DONE]' if a [DONE] sentinel is encountered
 *   (not sent by Gloo AI), or a parsed SSEChunk
 */
export function parseSseLine(line: string): null | "[DONE]" | SSEChunk {
  // TODO: Parse one SSE text line (Step 3):
  // 1. Return null if line is blank or does not start with "data: "
  // 2. Strip the "data: " prefix (6 chars): const data = line.slice(6)
  // 3. Return "[DONE]" if data.trim() === "[DONE]"
  // 4. Try JSON.parse(data) as SSEChunk; return null on parse error
  throw new Error("Not implemented - see TODO comments");
}

/**
 * Safely extract the text content from a parsed SSE chunk.
 *
 * @param chunk - Parsed SSEChunk from parseSseLine
 * @returns The token text, or '' if none present
 */
export function extractTokenContent(chunk: SSEChunk): string {
  // TODO: Extract delta content from a parsed SSE chunk (Step 4):
  // 1. Get choices = chunk?.choices — return "" if falsy or empty
  // 2. Get content = choices[0]?.delta?.content
  // 3. Return content || ""
  // Wrap in try/catch and return "" on any error
  throw new Error("Not implemented - see TODO comments");
}

/**
 * Accumulation loop: stream a completion and collect the full result.
 *
 * @param message - The user message to send
 * @param token - Valid Bearer token for authorization
 * @returns StreamResult with text, token_count, duration_ms, finish_reason
 */
export async function streamCompletion(message: string, token: string): Promise<StreamResult> {
  // TODO: Implement the accumulation loop (Step 5):
  // 1. Record startTime = Date.now()
  // 2. Call makeStreamingRequest(message, token)
  // 3. Initialize fullText = "", tokenCount = 0, finishReason = "unknown"
  // 4. Set up a ReadableStream reader: response.body!.getReader()
  // 5. Use a TextDecoder and a buffer string to reassemble lines across chunks
  // 6. In a loop: read chunks, split on "\n", parse each line with parseSseLine
  //    a. Skip null chunks; break on "[DONE]"
  //    b. extractTokenContent — append to fullText, increment tokenCount
  //    c. Capture choices[0].finish_reason when non-null
  // 7. Call reader.releaseLock() in a finally block
  // 8. Return { text: fullText, token_count: tokenCount, duration_ms: Date.now() - startTime, finish_reason: finishReason }
  throw new Error("Not implemented - see TODO comments");
}
