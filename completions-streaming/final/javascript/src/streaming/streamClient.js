/**
 * Streaming client for Gloo AI completions API.
 *
 * Implements SSE parsing, token extraction, and accumulation loop for
 * real-time streaming responses using the fetch API with ReadableStream.
 */

const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

/**
 * Check HTTP status before reading stream and throw specific errors.
 *
 * @param {number} statusCode - HTTP status code
 * @param {string} [responseBody] - Response body for generic errors
 * @throws {Error} With a descriptive message for 401, 403, 429, and other errors
 */
export function handleStreamError(statusCode, responseBody = "") {
  if (statusCode === 401) {
    throw new Error("Authentication failed (401): Invalid or expired token");
  } else if (statusCode === 403) {
    throw new Error("Authorization failed (403): Insufficient permissions");
  } else if (statusCode === 429) {
    throw new Error("Rate limit exceeded (429): Too many requests");
  } else if (statusCode !== 200) {
    throw new Error(`API error (${statusCode}): ${String(responseBody).slice(0, 200)}`);
  }
}

/**
 * POST to the completions API with stream:true and return the raw Response.
 *
 * @param {string} message - The user message to send
 * @param {string} token - Valid Bearer token for authorization
 * @returns {Promise<Response>} Raw fetch Response with streaming body
 * @throws {Error} If the server returns a non-200 status
 */
export async function makeStreamingRequest(message, token) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      auto_routing: true,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    handleStreamError(response.status, body);
  }

  return response;
}

/**
 * Parse one SSE text line from the stream.
 *
 * SSE lines follow the format `data: <json-payload>`. The stream ends when a chunk
 * arrives with a non-null `choices[0].finish_reason` (e.g. "stop"). A `[DONE]`
 * sentinel is handled for compatibility but is not sent by the Gloo AI API.
 *
 * @param {string} line - Raw text line from the SSE stream
 * @returns {null|'[DONE]'|Object} null for blank/non-data lines,
 *   '[DONE]' if a [DONE] sentinel is encountered (not sent by Gloo AI), or a parsed JSON object
 */
export function parseSseLine(line) {
  if (!line || !line.trim()) return null;
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6); // strip 'data: '
  if (data.trim() === "[DONE]") return "[DONE]";
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Safely extract the text content from a parsed SSE chunk.
 *
 * @param {Object} chunk - Parsed JSON dict from parseSseLine
 * @returns {string} The token text, or '' if none present
 */
export function extractTokenContent(chunk) {
  try {
    const choices = chunk?.choices;
    if (!choices || choices.length === 0) return "";
    const content = choices[0]?.delta?.content;
    return content || "";
  } catch {
    return "";
  }
}

/**
 * Accumulation loop: stream a completion and collect the full result.
 *
 * Uses the fetch ReadableStream API to iterate SSE lines, parse each,
 * extract content, and build the full response text.
 *
 * @param {string} message - The user message to send
 * @param {string} token - Valid Bearer token for authorization
 * @returns {Promise<Object>} StreamResult:
 *   { text, token_count, duration_ms, finish_reason }
 */
export async function streamCompletion(message, token) {
  const startTime = Date.now();
  const response = await makeStreamingRequest(message, token);

  let fullText = "";
  let tokenCount = 0;
  let finishReason = "unknown";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseSseLine(line);
        if (chunk === null) continue;
        if (chunk === "[DONE]") break;

        const content = extractTokenContent(chunk);
        if (content) {
          fullText += content;
          tokenCount += 1;
        }

        const choices = chunk?.choices;
        if (choices && choices[0]?.finish_reason) {
          finishReason = choices[0].finish_reason;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const durationMs = Date.now() - startTime;
  return {
    text: fullText,
    token_count: tokenCount,
    duration_ms: durationMs,
    finish_reason: finishReason,
  };
}
