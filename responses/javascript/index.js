#!/usr/bin/env node

/**
 * Gloo AI Guarded Responses API Recipe - JavaScript
 *
 * This example demonstrates four features of the Gloo AI Responses API
 * (POST /ai/v2/guarded/responses): basic guarded responses with tradition,
 * instructions + multi-turn input, streaming (SSE), and vision (image input).
 */

require("dotenv").config();

// Configuration
const API_KEY = process.env.GLOO_API_KEY || "YOUR_API_KEY";
const API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/responses";

/**
 * True when a .env value is an unset placeholder (empty or a TODO comment).
 */
function envIsPlaceholder(value) {
  const stripped = value.trim();
  return stripped === "" || stripped.startsWith("#");
}

/**
 * Env value or default, ignoring unset placeholders (empty / TODO comments).
 */
function env(name, defaultValue) {
  const value = process.env[name] || "";
  return envIsPlaceholder(value) ? defaultValue : value;
}

const MODEL = env("GLOO_MODEL", "gloo-anthropic-claude-sonnet-4.6");
const VISION_MODEL = env("GLOO_VISION_MODEL", "gloo-google-gemini-3.1-pro");
const VISION_IMAGE_URL = env(
  "VISION_IMAGE_URL",
  "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg"
);

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * POST a request, throwing a clear error (including the response body) on failure.
 */
async function post(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    const hint = response.status === 403 ? " (guardrails hard-blocked this request)" : "";
    throw new Error(`API request failed with status ${response.status}${hint}: ${body}`);
  }
  return response.json();
}

/**
 * Extract assistant text from a Responses API payload's output[] array.
 */
function extractText(result) {
  const parts = [];
  for (const item of result.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text") {
        parts.push(content.text || "");
      }
    }
  }
  return parts.join("\n");
}

/**
 * Example 1: Basic guarded response with a theological tradition.
 */
function makeBasicResponse(message, tradition = "evangelical") {
  const payload = {
    model: MODEL,
    input: message,
    tradition: tradition,
    max_output_tokens: 256,
  };
  return post(payload);
}

/**
 * Example 2: Instructions plus multi-turn input array (alternating user/assistant roles).
 */
function makeInstructionsResponse(instructions, inputItems) {
  const payload = {
    model: MODEL,
    instructions: instructions,
    input: inputItems,
    max_output_tokens: 256,
  };
  return post(payload);
}

/**
 * Example 3: Streaming via SSE; returns { text, usage }.
 */
async function streamResponse(message) {
  const payload = {
    model: MODEL,
    input: message,
    stream: true,
    max_output_tokens: 256,
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    const hint = response.status === 403 ? " (guardrails hard-blocked this request)" : "";
    throw new Error(`API request failed with status ${response.status}${hint}: ${body}`);
  }

  const textParts = [];
  const doneParts = [];
  let usage = null;

  // Note: each data: payload is the flattened event object itself (its "type"
  // matches the event: line); there is no nested "response" key, and the
  // response.completed payload carries usage but not the output[] array.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = null;

  const handleData = (data, currentEvent) => {
    if (currentEvent === "response.output_text.delta") {
      const delta = data.delta || "";
      process.stdout.write(delta);
      textParts.push(delta);
    } else if (currentEvent === "response.output_text.done") {
      doneParts.push(data.text || "");
    } else if (currentEvent === "response.completed") {
      // Docs nest the final response under "response"; the live API
      // flattens it into the payload itself. Accept both shapes.
      const final = data.response || data;
      usage = final.usage || null;
      if (textParts.length === 0 && doneParts.length === 0) {
        doneParts.push(extractText(final));
      }
    } else if (currentEvent !== null && currentEvent.startsWith("response.")) {
      // Other lifecycle events (response.created, response.in_progress,
      // response.output_item.*, response.content_part.*, ...).
    } else if (currentEvent !== null && currentEvent.startsWith("error")) {
      // Error events are terminal.
      throw new Error(`Stream error event '${currentEvent}': ${JSON.stringify(data)}`);
    } else {
      // Unknown event: treat as terminal and close the stream.
      throw new Error(`Stream terminated by unknown event '${currentEvent}': ${JSON.stringify(data)}`);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        if (line.startsWith("event:")) {
          event = line.slice("event:".length).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;

        let data;
        try {
          data = JSON.parse(line.slice("data:".length).trim());
        } catch {
          // Malformed SSE data is a terminal error, not something to skip.
          throw new Error(`Stream terminated by malformed SSE data: ${rawLine}`);
        }
        handleData(data, event);
        event = null;
      }
    }
  } finally {
    reader.releaseLock();
  }

  process.stdout.write("\n");
  const text = textParts.join("") || doneParts.join("");
  return { text, usage };
}

/**
 * Example 4: Vision — image input via typed content parts.
 */
function makeVisionResponse(imageUrl, question) {
  const payload = {
    model: VISION_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: question },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
    max_output_tokens: 256,
  };
  return post(payload);
}

async function testResponsesApi() {
  console.log("=== Gloo AI Guarded Responses API Test ===\n");

  try {
    // Example 1: Basic guarded response with tradition
    console.log("Example 1: Basic Guarded Response (tradition=evangelical)");
    console.log("Testing: How can our small group support a grieving member?");
    const result1 = await makeBasicResponse("How can our small group support a grieving member?");
    console.log(`   Model used: ${result1.model || "N/A"}`);
    const text1 = extractText(result1);
    console.log(`   Response: ${text1.slice(0, 100)}...`);
    console.log(`   Usage: ${JSON.stringify(result1.usage ?? "N/A")}`);
    console.log("   ✓ Example 1 passed\n");

    // Example 2: Instructions + multi-turn input
    console.log("Example 2: Instructions + Multi-turn Input");
    console.log("Testing: three-turn conversation (user → assistant → user) with pastoral-care instructions");
    const result2 = await makeInstructionsResponse(
      "You are a compassionate pastoral assistant. Keep answers brief and warm.",
      [
        {
          role: "user",
          content: "I've been asked to lead a grief support group at church. Where do I start?",
        },
        {
          role: "assistant",
          content: "That's a meaningful calling. Start with prayerful preparation — ask God to prepare your own heart before you prepare the room.",
        },
        {
          role: "user",
          content: "What should I do in the very first meeting?",
        },
      ]
    );
    console.log(`   Model used: ${result2.model || "N/A"}`);
    const text2 = extractText(result2);
    console.log(`   Response: ${text2.slice(0, 100)}...`);
    console.log(`   Usage: ${JSON.stringify(result2.usage ?? "N/A")}`);
    console.log("   ✓ Example 2 passed\n");

    // Example 3: Streaming
    console.log("Example 3: Streaming (SSE)");
    console.log("Testing: Write a one-paragraph prayer for a new season of ministry.");
    const { text: text3, usage: usage3 } = await streamResponse(
      "Write a one-paragraph prayer for a new season of ministry."
    );
    console.log(`   Model used: ${MODEL}`);
    console.log(`   Streamed text (${text3.length} chars): ${text3.slice(0, 100)}...`);
    console.log(`   Usage: ${JSON.stringify(usage3 ?? "N/A")}`);
    if (!text3) {
      throw new Error("streaming produced no text");
    }
    if (usage3 === null) {
      throw new Error("streaming produced no usage");
    }
    console.log("   ✓ Example 3 passed\n");

    // Example 4: Vision
    console.log("Example 4: Vision (Image Input)");
    console.log(`Testing: ${VISION_IMAGE_URL}`);
    const result4 = await makeVisionResponse(VISION_IMAGE_URL, "What animal is in this image?");
    console.log(`   Model used: ${result4.model || "N/A"}`);
    const text4 = extractText(result4);
    console.log(`   Response: ${text4.slice(0, 100)}...`);
    console.log(`   Usage: ${JSON.stringify(result4.usage ?? "N/A")}`);
    console.log("   ✓ Example 4 passed\n");

    console.log("=== All Responses API tests passed! ===");
    return true;
  } catch (e) {
    console.log(`✗ Test failed: ${e.message}`);
    return false;
  }
}

async function main() {
  if (!API_KEY.trim() || API_KEY === "YOUR_API_KEY") {
    console.log("Please set your GLOO_API_KEY environment variable");
    console.log("You can create a .env file with:");
    console.log("GLOO_API_KEY=your_api_key");
    return;
  }

  const ok = await testResponsesApi();
  if (!ok) process.exitCode = 1;
}

main();
