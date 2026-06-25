#!/usr/bin/env node
/**
 * Gloo AI RAG Pipeline - Part 3: Verification, Error Handling & Resilience (JavaScript)
 *
 * Builds a small resilient API client and demonstrates three production
 * concerns against the Gloo AI Data Engine:
 *
 *   1. Interpreting structured API error responses (status, code, message)
 *   2. Retrying transient failures with exponential backoff
 *   3. Verifying ingestion health, handling missing items gracefully
 *
 * There are no monitoring or health-check endpoints — resilience here is built
 * from the same item APIs used in Parts 1 and 2, plus disciplined error handling.
 */

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET ?? "";
const PUBLISHER_ID = process.env.GLOO_PUBLISHER_ID ?? "";

const API_ROOT = "https://platform.ai.gloo.com";
const TOKEN_URL = `${API_ROOT}/oauth2/token`;
const UPLOAD_URL = `${API_ROOT}/ingestion/v2/files`;
const ITEMS_URL = `${API_ROOT}/engine/v2/items`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.join(__dirname, "..", "sample_files");
const SEED_ITEMS = [
  ["strengthening-feedback-loops.md", "rag-pipeline-part3-feedback-loops"],
  ["learning-from-incidents.md", "rag-pipeline-part3-incident-reviews"],
];

// Retry policy: only transient failures are retried. Client errors (400, 401,
// 403, 404, 422) are bugs in the request, not blips, so they fail fast.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

// Ingestion polling (asynchronous; ~6 minutes for a small file).
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 600_000;

for (const [name, value] of [
  ["GLOO_CLIENT_ID", CLIENT_ID],
  ["GLOO_CLIENT_SECRET", CLIENT_SECRET],
  ["GLOO_PUBLISHER_ID", PUBLISHER_ID],
]) {
  if (!value) {
    console.error(`Error: ${name} must be set. Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A normalized API error: HTTP status (null for network failures), a
 * machine-readable code, and a human-readable message. */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  isRetryable() {
    // Network failures (status null) and transient server statuses are retryable.
    return this.status === null || RETRYABLE_STATUSES.has(this.status);
  }
}

/** Manages OAuth2 client-credentials token lifecycle. */
class TokenManager {
  #tokenInfo = null;

  async getToken() {
    if (this.#isExpired()) {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: "api/access" }),
      });
      if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
      this.#tokenInfo = await response.json();
      this.#tokenInfo.expiresAt = Date.now() + this.#tokenInfo.expires_in * 1000;
    }
    return this.#tokenInfo.access_token;
  }

  /** Drop the cached token so the next call fetches a fresh one. */
  forceRefresh() {
    this.#tokenInfo = null;
  }

  #isExpired() {
    return !this.#tokenInfo || Date.now() > this.#tokenInfo.expiresAt - 60_000;
  }
}

/** A thin HTTP client with structured error parsing, retry-with-backoff,
 * and one-shot token refresh on 401. */
class ResilientClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /** Extract [code, message] from the API's error shapes:
   * {"detail": {"code", "message"}}, {"detail": "..."}, {"error", "message"}. */
  async parseError(response) {
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return [null, text.slice(0, 200) || response.statusText];
    }
    if (body && typeof body === "object") {
      const detail = body.detail;
      if (detail && typeof detail === "object") {
        return [detail.code ?? null, detail.message || response.statusText];
      }
      if (typeof detail === "string") return [null, detail];
      if ("error" in body || "message" in body) {
        return [body.error ?? null, body.message || response.statusText];
      }
    }
    return [null, text.slice(0, 200)];
  }

  async backoff(attempt, status, code) {
    const delay = BASE_DELAY_MS * 2 ** attempt;
    const label = status ?? "network error";
    console.log(`    Attempt ${attempt + 1} failed (${label}: ${code}); retrying in ${delay / 1000}s`);
    await sleep(delay);
  }

  /** Send a request, retrying transient failures and refreshing the token once
   * on 401. Throws ApiError on non-retryable failures or exhausted retries. */
  async request(method, url, { json, params, token, allowRefresh = true, parse = true } = {}) {
    let target = url;
    if (params) target += `?${new URLSearchParams(params)}`;
    let refreshed = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const bearer = token ?? (await this.tokenManager.getToken());
      let response;
      try {
        response = await fetch(target, {
          method,
          headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: json !== undefined ? JSON.stringify(json) : undefined,
        });
      } catch (e) {
        if (attempt < MAX_RETRIES) {
          await this.backoff(attempt, null, "connection");
          continue;
        }
        throw new ApiError(null, "network_error", String(e.message ?? e));
      }

      if (response.status === 401 && allowRefresh && !refreshed) {
        refreshed = true;
        this.tokenManager.forceRefresh();
        continue; // retry immediately with a fresh token
      }

      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        const [code] = await this.parseError(response);
        await this.backoff(attempt, response.status, code);
        continue;
      }

      if (!response.ok) {
        const [code, message] = await this.parseError(response);
        throw new ApiError(response.status, code, message);
      }

      return parse ? response.json() : response;
    }
    throw new ApiError(null, "retries_exhausted", "Exhausted retries");
  }

  /** Run an operation, retrying it on retryable ApiError with backoff. */
  async callWithRetry(operation, label = "operation") {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (e) {
        if (e instanceof ApiError && e.isRetryable() && attempt < MAX_RETRIES) {
          await this.backoff(attempt, e.status, e.code);
          continue;
        }
        throw e;
      }
    }
    throw new ApiError(null, "retries_exhausted", `Exhausted retries for ${label}`);
  }

  /** Upload a single file, retrying transient failures (5xx or network blips). */
  async uploadFile(filePath, producerId) {
    const fileBytes = await readFile(filePath);
    const operation = async () => {
      const form = new FormData();
      form.append("publisher_id", PUBLISHER_ID);
      form.append("files", new Blob([fileBytes]), path.basename(filePath));
      const response = await fetch(
        `${UPLOAD_URL}?producer_id=${encodeURIComponent(producerId)}`,
        { method: "POST", headers: { Authorization: `Bearer ${await this.tokenManager.getToken()}` }, body: form }
      );
      if (!response.ok) {
        const [code, message] = await this.parseError(response);
        throw new ApiError(response.status, code, message);
      }
      return response.json();
    };
    const result = await this.callWithRetry(operation, "upload");
    return (result.ingesting?.length ? result.ingesting : result.duplicates)[0];
  }

  getItem(itemId) {
    return this.request("GET", `${ITEMS_URL}/${itemId}`);
  }

  deleteItems(itemIds) {
    return this.request("DELETE", ITEMS_URL, { json: { item_ids: itemIds } });
  }

  async waitUntilIndexed(itemIds) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const pending = new Set(itemIds);
    while (pending.size > 0 && Date.now() < deadline) {
      for (const itemId of [...pending]) {
        const status = ((await this.getItem(itemId)).status ?? "unknown").toUpperCase();
        if (status === "COMPLETED") pending.delete(itemId);
        else if (["FAILED", "ERROR"].includes(status)) {
          throw new ApiError(null, "ingestion_failed", `${itemId}: ${status}`);
        }
      }
      if (pending.size > 0) {
        console.log(`  Waiting for ${pending.size} item(s) to finish indexing...`);
        await sleep(POLL_INTERVAL_MS);
      }
    }
    if (pending.size > 0) throw new ApiError(null, "ingestion_timeout", "Not indexed within timeout");
  }
}

/** Trigger representative error responses and show the parsed result. */
async function demoErrorHandling(client) {
  const cases = [
    ["Missing item (random UUID)", "GET", `${ITEMS_URL}/${randomUUID()}`, {}],
    ["Malformed item ID", "GET", `${ITEMS_URL}/not-a-valid-uuid`, {}],
    ["Rejected bearer token", "GET", `${ITEMS_URL}/${randomUUID()}`, { token: "invalid-token", allowRefresh: false }],
  ];
  for (const [label, method, url, opts] of cases) {
    try {
      await client.request(method, url, opts);
      console.log(`  ${label}: unexpectedly succeeded`);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      console.log(`  ${label}: status=${e.status} code='${e.code}' message='${e.message}'`);
    }
  }
}

/** Show the backoff policy recovering from transient failures.
 * Simulates a service returning 503 twice before succeeding — the same path a
 * real 5xx or network error would take. */
async function demoRetry(client) {
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls < 3) throw new ApiError(503, "service_unavailable", "Service temporarily unavailable");
    return { ok: true };
  };
  await client.callWithRetry(flaky, "sample operation");
  console.log(`  Succeeded after ${calls} attempts`);
}

/** Upload a batch, confirm each item indexed, and report a health summary
 * that also surfaces a missing item. */
async function demoHealthCheck(client) {
  console.log("  Uploading and indexing a batch...");
  const itemIds = [];
  for (const [filename, producerId] of SEED_ITEMS) {
    itemIds.push(await client.uploadFile(path.join(SAMPLE_DIR, filename), producerId));
  }
  await client.waitUntilIndexed(itemIds);

  // Include an ID that doesn't exist to show graceful handling of 404s.
  const toCheck = [...itemIds, randomUUID()];
  const summary = { completed: 0, pending: 0, failed: 0, notFound: 0 };
  for (const itemId of toCheck) {
    try {
      const status = ((await client.getItem(itemId)).status ?? "unknown").toUpperCase();
      if (status === "COMPLETED") summary.completed += 1;
      else if (["FAILED", "ERROR"].includes(status)) summary.failed += 1;
      else summary.pending += 1;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) summary.notFound += 1;
      else throw e;
    }
  }
  console.log(
    `  Health: ${summary.completed} completed, ${summary.pending} pending, ` +
      `${summary.failed} failed, ${summary.notFound} not found`
  );

  await client.deleteItems(itemIds);
  console.log(`  Cleaned up ${itemIds.length} item(s)`);
}

async function main() {
  const client = new ResilientClient(new TokenManager());

  console.log("Step 1: Resilient client ready (token refresh, error parsing, retry/backoff).");

  console.log("\nStep 2: Interpreting API error responses...");
  await demoErrorHandling(client);

  console.log("\nStep 3: Retrying transient failures with backoff...");
  await demoRetry(client);

  console.log("\nStep 4: Verifying ingestion health...");
  await demoHealthCheck(client);

  console.log("\nDone. The resilient client handled errors, retries, and verification end to end.");
}

main().catch((error) => {
  if (error instanceof ApiError) console.error(`API error: ${error.message}`);
  else console.error(`Error: ${error.message}`);
  process.exit(1);
});
