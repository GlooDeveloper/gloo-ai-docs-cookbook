/**
 * Gloo AI RAG Pipeline - Part 1: Set Up the Pipeline (TypeScript)
 *
 * Uploads sample content to a publisher, enriches it with metadata,
 * and polls the Data Engine until the item is fully indexed.
 */

import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET ?? "";
const PUBLISHER_ID = process.env.GLOO_PUBLISHER_ID ?? "";

const API_ROOT = "https://platform.ai.gloo.com";
const TOKEN_URL = `${API_ROOT}/oauth2/token`;
const UPLOAD_URL = `${API_ROOT}/ingestion/v2/files`;
const ITEM_METADATA_URL = `${API_ROOT}/engine/v2/item`;
const ITEM_STATUS_URL = `${API_ROOT}/engine/v2/items`;

const SAMPLE_FILE = path.join(__dirname, "..", "sample_files", "building-stronger-communities.md");
const PRODUCER_ID = "rag-pipeline-part1-building-stronger-communities";

// Polling configuration: ingestion is asynchronous and typically
// takes several minutes (observed ~6 minutes for a small file).
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 600_000;

interface TokenInfo {
  access_token: string;
  expires_in: number;
  expiresAt: number;
}

interface UploadResponse {
  success: boolean;
  message: string;
  ingesting: string[];
  duplicates: string[];
}

interface ItemMetadata {
  item_id: string;
  status: string;
  item_title: string | null;
  author: string[];
  item_tags: string[];
  [key: string]: unknown;
}

const requiredEnv: Array<[string, string]> = [
  ["GLOO_CLIENT_ID", CLIENT_ID],
  ["GLOO_CLIENT_SECRET", CLIENT_SECRET],
  ["GLOO_PUBLISHER_ID", PUBLISHER_ID],
];
for (const [name, value] of requiredEnv) {
  if (!value) {
    console.error(`Error: ${name} must be set. Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Manages OAuth2 client-credentials token lifecycle. */
class TokenManager {
  private tokenInfo: TokenInfo | null = null;

  async getToken(): Promise<string> {
    if (this.isExpired()) {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: "api/access" }),
      });
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status} ${await response.text()}`);
      }
      const data = (await response.json()) as Omit<TokenInfo, "expiresAt">;
      this.tokenInfo = { ...data, expiresAt: Date.now() + data.expires_in * 1000 };
    }
    return this.tokenInfo!.access_token;
  }

  private isExpired(): boolean {
    return !this.tokenInfo || Date.now() > this.tokenInfo.expiresAt - 60_000;
  }
}

/** Uploads content, sets metadata, and verifies indexing. */
class PipelineSetup {
  constructor(private readonly tokenManager: TokenManager) {}

  private async headers(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.tokenManager.getToken()}` };
  }

  /**
   * Upload a single file; return its item ID.
   *
   * A stable producer_id makes re-runs idempotent: if the same content
   * was already uploaded, the API reports it as a duplicate and we
   * reuse the existing item instead of creating a new one.
   */
  async uploadFile(filePath: string): Promise<string> {
    const form = new FormData();
    form.append("publisher_id", PUBLISHER_ID);
    form.append("files", new Blob([readFileSync(filePath)]), path.basename(filePath));

    const url = `${UPLOAD_URL}?producer_id=${encodeURIComponent(PRODUCER_ID)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: await this.headers(),
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }
    const result = (await response.json()) as UploadResponse;

    if (result.ingesting.length > 0) {
      console.log(`  Queued for ingestion: ${result.ingesting[0]}`);
      return result.ingesting[0];
    }
    if (result.duplicates.length > 0) {
      console.log(`  Already ingested (duplicate detected), reusing item: ${result.duplicates[0]}`);
      return result.duplicates[0];
    }
    throw new Error(`Unexpected upload response: ${JSON.stringify(result)}`);
  }

  /** Attach descriptive metadata to the uploaded item. */
  async setMetadata(itemId: string): Promise<void> {
    const metadata = {
      publisher_id: PUBLISHER_ID,
      item_id: itemId,
      item_title: "Building Stronger Communities Through Service",
      item_summary: "Practical guidance for starting and sustaining community service efforts.",
      author: ["Gloo AI Docs Team"],
      item_tags: ["community", "service", "rag-pipeline-series"],
    };
    const response = await fetch(ITEM_METADATA_URL, {
      method: "PATCH",
      headers: { ...(await this.headers()), "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      throw new Error(`Metadata update failed: ${response.status} ${await response.text()}`);
    }
    console.log(`  Metadata set: title, summary, author, ${metadata.item_tags.length} tags`);
  }

  /** Fetch current item metadata, including ingestion status. */
  async getItem(itemId: string): Promise<ItemMetadata> {
    const response = await fetch(`${ITEM_STATUS_URL}/${itemId}`, {
      headers: await this.headers(),
    });
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as ItemMetadata;
  }

  /** Poll item status until indexing completes or the timeout elapses. */
  async waitUntilIndexed(itemId: string): Promise<ItemMetadata> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let lastStatus: string | null = null;

    while (Date.now() < deadline) {
      const item = await this.getItem(itemId);
      const status = item.status ?? "unknown";

      if (status !== lastStatus) {
        console.log(`  Status: ${status}`);
        lastStatus = status;
      }

      // Terminal states (observed: CHUNKING while processing, COMPLETED when done).
      if (status.toUpperCase() === "COMPLETED") return item;
      if (["FAILED", "ERROR"].includes(status.toUpperCase())) {
        throw new Error(`Ingestion failed with status: ${status}`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Item ${itemId} not indexed within ${POLL_TIMEOUT_MS / 1000}s (last status: ${lastStatus})`
    );
  }
}

(async () => {
  try {
    const pipeline = new PipelineSetup(new TokenManager());

    console.log("Step 1: Uploading sample content...");
    const itemId = await pipeline.uploadFile(SAMPLE_FILE);

    console.log("\nStep 2: Setting item metadata...");
    await pipeline.setMetadata(itemId);

    console.log("\nStep 3: Verifying indexing (polling)...");
    const item = await pipeline.waitUntilIndexed(itemId);

    console.log("\nPipeline content is indexed and ready.");
    console.log(`  Item ID:  ${item.item_id}`);
    console.log(`  Title:    ${item.item_title}`);
    console.log(`  Author:   ${(item.author ?? []).join(", ")}`);
    console.log(`  Tags:     ${(item.item_tags ?? []).join(", ")}`);
    console.log(`  Status:   ${item.status}`);
    console.log("\nNext: query this content with the Search API, or ask questions about it");
    console.log("with Grounded Completions (see the deep-dive recipes).");
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
})();
