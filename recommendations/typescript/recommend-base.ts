/**
 * Gloo AI Recommendations API - Base Recommendations
 *
 * Fetches publisher-scoped item recommendations with snippet metadata
 * but without snippet text — ideal for a clean recommendations list.
 *
 * Usage:
 *   npx ts-node recommend-base.ts <query> [item_count]
 *
 * Examples:
 *   npx ts-node recommend-base.ts "How do I deal with anxiety?"
 *   npx ts-node recommend-base.ts "parenting teenagers" 3
 */

import axios from "axios";
import {
  API_KEY,
  COLLECTION,
  TENANT,
  RECOMMENDATIONS_BASE_URL,
  DEFAULT_ITEM_COUNT,
} from "./config";

// --- Types ---

interface SnippetUuidBase {
  uuid: string;
  ai_title?: string;
  ai_subtitle?: string;
  item_summary?: string;
  time_start?: string;
  time_end?: string;
  part?: number;
  certainty?: number;
}

interface RecommendationItemBase {
  item_id?: string;
  item_title?: string;
  item_subtitle?: string;
  item_url?: string;
  item_image?: string;
  author?: string[];
  tradition?: string;
  duration?: string;
  uuids?: SnippetUuidBase[];
}

// --- Validation ---

export function validateApiKey(apiKey: string): void {
  if (!apiKey) {
    console.error("Error: GLOO_API_KEY must be set");
    console.log("Create a .env file with your API key:");
    console.log("GLOO_API_KEY=your_api_key_here");
    console.log("GLOO_TENANT=your_tenant_name_here");
    console.log("GLOO_COLLECTION=GlooProd");
    process.exit(1);
  }
}

// --- Client ---

export class RecommendationsClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch publisher-scoped recommendations (metadata only, no snippet text).
   * @param query - The user's query or topic
   * @param itemCount - Maximum number of items to return
   */
  async getBase(
    query: string,
    itemCount: number = DEFAULT_ITEM_COUNT
  ): Promise<RecommendationItemBase[]> {
    const payload = {
      query,
      collection: COLLECTION,
      tenant: TENANT,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post<RecommendationItemBase[]>(
        RECOMMENDATIONS_BASE_URL,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error(
          `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`Recommendations request failed: ${error.message}`);
    }
  }
}

// --- Runner ---

async function run(
  query: string,
  itemCount: number = DEFAULT_ITEM_COUNT
): Promise<void> {
  const client = new RecommendationsClient(API_KEY);

  console.log(`Fetching recommendations for: '${query}'`);
  console.log(`Requesting up to ${itemCount} items\n`);

  const items = await client.getBase(query, itemCount);

  if (!items || items.length === 0) {
    console.log("No recommendations found.");
    return;
  }

  console.log(`Found ${items.length} recommended item(s):\n`);

  items.forEach((item, i) => {
    console.log(`--- Item ${i + 1} ---`);
    console.log(`Title:  ${item.item_title || "N/A"}`);

    if (item.author?.length) console.log(`Author: ${item.author.join(", ")}`);

    // uuids holds the matched snippets with relevance scores
    const top = item.uuids?.[0];
    if (top) {
      console.log(`Relevance: ${(top.certainty ?? 0).toFixed(2)}`);
      if (top.ai_title) console.log(`Section:   ${top.ai_title}`);
      if (top.item_summary) {
        console.log(`Summary:   ${top.item_summary.substring(0, 200)}`);
      }
    }

    if (item.item_url) console.log(`URL:    ${item.item_url}`);
    console.log();
  });
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npx ts-node recommend-base.ts <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find recommendations for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  npx ts-node recommend-base.ts "How do I deal with anxiety?"');
  console.log('  npx ts-node recommend-base.ts "parenting teenagers" 3');
}

async function main(): Promise<void> {
  validateApiKey(API_KEY);

  const args = process.argv.slice(2);
  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const query = args[0];
  const itemCount = args[1]
    ? Math.max(1, Math.min(Number.parseInt(args[1], 10) || DEFAULT_ITEM_COUNT, 50))
    : DEFAULT_ITEM_COUNT;

  try {
    await run(query, itemCount);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
