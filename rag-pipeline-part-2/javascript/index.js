#!/usr/bin/env node
/**
 * Gloo AI RAG Pipeline - Part 2: Content Lifecycle (JavaScript)
 *
 * Seeds a small set of items, then demonstrates the content lifecycle:
 * update a single item, bulk-edit several items, verify the changes, and
 * delete the items (cleanup).
 *
 * Every mutation is scoped to the exact item IDs this recipe created —
 * captured from the upload responses — so it never touches other content
 * in the publisher.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

// --- Configuration ---
const API_KEY = process.env.GLOO_API_KEY ?? "";
const PUBLISHER_ID = process.env.GLOO_PUBLISHER_ID ?? "";

const API_ROOT = "https://platform.ai.gloo.com";
const UPLOAD_URL = `${API_ROOT}/ingestion/v2/files`;
const ITEM_URL = `${API_ROOT}/engine/v2/item`; // single-item update (PATCH)
const ITEMS_URL = `${API_ROOT}/engine/v2/items`; // bulk patch (PATCH), delete (DELETE)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.join(__dirname, "..", "sample_files");

// The items this recipe manages. Producer IDs are stable identifiers you assign;
// here they share a prefix unique to this recipe.
const SEED_ITEMS = [
  {
    file: "volunteer-onboarding.md",
    producer_id: "rag-pipeline-part2-volunteer-onboarding",
    item_title: "Onboarding New Volunteers",
    item_summary: "How a warm, organized welcome turns newcomers into committed volunteers.",
    author: ["Gloo AI Docs Team"],
    item_tags: ["volunteers", "rag-pipeline-series"],
  },
  {
    file: "measuring-community-impact.md",
    producer_id: "rag-pipeline-part2-measuring-impact",
    item_title: "Measuring Community Impact",
    item_summary: "Why measuring outcomes, not activity, sustains community programs.",
    author: ["Gloo AI Docs Team"],
    item_tags: ["measurement", "rag-pipeline-series"],
  },
  {
    file: "sustaining-engagement.md",
    producer_id: "rag-pipeline-part2-sustaining-engagement",
    item_title: "Sustaining Long-Term Engagement",
    item_summary: "Practices that keep volunteers engaged through the long haul.",
    author: ["Gloo AI Docs Team"],
    item_tags: ["engagement", "rag-pipeline-series"],
  },
];

// Ingestion is asynchronous and typically takes several minutes.
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 600_000;

// Edits succeed immediately, but the read path is eventually consistent:
// a freshly patched item can take a few seconds to reflect the change on a
// subsequent GET. Verification re-fetches until the change is visible.
const VERIFY_ATTEMPTS = 20;
const VERIFY_INTERVAL_MS = 3_000;

for (const [name, value] of [
  ["GLOO_API_KEY", API_KEY],
  ["GLOO_PUBLISHER_ID", PUBLISHER_ID],
]) {
  if (!value) {
    console.error(`Error: ${name} must be set. Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Seeds content and performs scoped lifecycle operations on it. */
class ContentLifecycle {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  #headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  #jsonHeaders() {
    return { ...this.#headers(), "Content-Type": "application/json" };
  }

  /**
   * Upload a single file under a stable producer ID; return its item ID.
   * The upload response is the authoritative source of the item ID — keep it.
   */
  async uploadFile(filePath, producerId) {
    const form = new FormData();
    form.append("publisher_id", PUBLISHER_ID);
    form.append("files", new Blob([await readFile(filePath)]), path.basename(filePath));

    const url = `${UPLOAD_URL}?producer_id=${encodeURIComponent(producerId)}`;
    const response = await fetch(url, { method: "POST", headers: this.#headers(), body: form });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }
    const result = await response.json();
    const itemId = (result.ingesting?.length ? result.ingesting : result.duplicates)?.[0];
    if (!itemId) throw new Error(`Unexpected upload response: ${JSON.stringify(result)}`);
    return itemId;
  }

  /** Set metadata on a single item via PATCH /engine/v2/item. */
  async setMetadata(itemId, fields) {
    const payload = { publisher_id: PUBLISHER_ID, item_id: itemId, ...fields };
    const response = await fetch(ITEM_URL, {
      method: "PATCH",
      headers: this.#jsonHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Metadata update failed: ${response.status} ${await response.text()}`);
    }
  }

  /** Fetch current item metadata, including ingestion status. */
  async getItem(itemId) {
    const response = await fetch(`${ITEMS_URL}/${itemId}`, { headers: this.#headers() });
    if (!response.ok) throw new Error(`Get item failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  /** Return true while the item can still be fetched (false once deleted). */
  async itemExists(itemId) {
    const response = await fetch(`${ITEMS_URL}/${itemId}`, { headers: this.#headers() });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Get item failed: ${response.status} ${await response.text()}`);
    return true;
  }

  /** Poll until every item reaches COMPLETED or the timeout elapses. */
  async waitUntilIndexed(itemIds) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const pending = new Set(itemIds);

    while (pending.size > 0 && Date.now() < deadline) {
      for (const itemId of [...pending]) {
        const status = (await this.getItem(itemId)).status?.toUpperCase() ?? "UNKNOWN";
        if (status === "COMPLETED") pending.delete(itemId);
        else if (["FAILED", "ERROR"].includes(status)) {
          throw new Error(`Ingestion failed for ${itemId}: ${status}`);
        }
      }
      if (pending.size > 0) {
        console.log(`  Waiting for ${pending.size} item(s) to finish indexing...`);
        await sleep(POLL_INTERVAL_MS);
      }
    }
    if (pending.size > 0) throw new Error(`Items not indexed within timeout: ${[...pending]}`);
  }

  /** Apply patch operations to a specific set of items (scoped by item_ids). */
  async bulkPatch(itemIds, ops) {
    const url = `${ITEMS_URL}?publisher_id=${encodeURIComponent(PUBLISHER_ID)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.#jsonHeaders(),
      body: JSON.stringify({ filter: { item_ids: itemIds }, ops }),
    });
    if (!response.ok) throw new Error(`Bulk patch failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  /** Delete a specific set of items by ID. */
  async deleteItems(itemIds) {
    const response = await fetch(ITEMS_URL, {
      method: "DELETE",
      headers: this.#jsonHeaders(),
      body: JSON.stringify({ item_ids: itemIds }),
    });
    if (!response.ok) throw new Error(`Delete failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  /** Re-fetch an item until the given tag is visible (read-after-write retry). */
  async getItemWithTag(itemId, tag) {
    let item = await this.getItem(itemId);
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      if ((item.item_tags ?? []).includes(tag)) return item;
      await sleep(VERIFY_INTERVAL_MS);
      item = await this.getItem(itemId);
    }
    return item;
  }

  /** Re-check until the item is gone (GET returns 404), or attempts run out. */
  async waitUntilDeleted(itemId) {
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      if (!(await this.itemExists(itemId))) return true;
      await sleep(VERIFY_INTERVAL_MS);
    }
    return false;
  }
}

async function main() {
  const lifecycle = new ContentLifecycle(API_KEY);

  console.log("Step 1: Seeding sample content...");
  // Capture each item's ID from its upload response — the authoritative handle
  // we scope every later operation to.
  const mapping = {};
  for (const item of SEED_ITEMS) {
    const itemId = await lifecycle.uploadFile(path.join(SAMPLE_DIR, item.file), item.producer_id);
    await lifecycle.setMetadata(itemId, {
      item_title: item.item_title,
      item_summary: item.item_summary,
      author: item.author,
      item_tags: item.item_tags,
    });
    mapping[item.producer_id] = itemId;
    console.log(`  Uploaded ${item.producer_id} -> ${itemId}`);
  }
  const itemIds = Object.values(mapping);
  console.log("  Waiting for ingestion to complete (this can take a few minutes)...");
  await lifecycle.waitUntilIndexed(itemIds);
  console.log("  All seed items indexed.");

  console.log("\nStep 2: Updating a single item...");
  const targetProducer = "rag-pipeline-part2-volunteer-onboarding";
  await lifecycle.setMetadata(mapping[targetProducer], {
    item_title: "Onboarding New Volunteers: A First-Day Playbook",
    item_summary: "A practical first-day checklist for welcoming and retaining new volunteers.",
  });
  console.log(`  Updated title and summary for ${targetProducer}`);

  console.log("\nStep 3: Bulk-editing all seeded items...");
  const reviewTag = "reviewed-q2-2026";
  const result = await lifecycle.bulkPatch(itemIds, [
    { op: "append", field: "item_tags", value: [reviewTag] },
    { op: "replace", field: "author", value: ["Community Programs Team"] },
  ]);
  console.log(
    `  Matched ${result.total_matched}, patched ${result.total_patched}, failed ${result.total_failed}`
  );

  console.log("\nStep 4: Verifying changes...");
  for (const [, itemId] of Object.entries(mapping)) {
    const item = await lifecycle.getItemWithTag(itemId, reviewTag);
    console.log(`  ${item.item_title}`);
    console.log(`    author: ${(item.author ?? []).join(", ")}`);
    console.log(`    tags:   ${(item.item_tags ?? []).join(", ")}`);
  }

  console.log("\nStep 5: Deleting items (cleanup)...");
  const deletion = await lifecycle.deleteItems(itemIds);
  console.log(
    `  Requested ${deletion.total_requested}, deleted ${deletion.total_deleted}, failed ${deletion.total_failed}`
  );
  const allGone = (await Promise.all(itemIds.map((id) => lifecycle.waitUntilDeleted(id)))).every(Boolean);
  console.log(`  All items confirmed deleted: ${allGone}`);
  console.log("\nLifecycle complete. The publisher is back to its pre-recipe state.");
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
