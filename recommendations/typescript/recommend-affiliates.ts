/**
 * Gloo AI Recommendations API - Affiliate Referenced Items
 *
 * Surfaces relevant items from across the Gloo affiliate publisher network,
 * enabling cross-publisher discovery for "Explore more resources" features.
 *
 * Unlike the publisher-scoped endpoints, this endpoint does not require a
 * collection or tenant — it searches across the entire affiliate network.
 *
 * Usage:
 *   npx ts-node recommend-affiliates.ts <query> [item_count]
 *
 * Examples:
 *   npx ts-node recommend-affiliates.ts "How do I deal with anxiety?"
 *   npx ts-node recommend-affiliates.ts "parenting teenagers" 3
 */

import axios from "axios";
import { TokenManager, validateCredentials } from "./auth";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  AFFILIATES_URL,
  DEFAULT_ITEM_COUNT,
} from "./config";

// --- Types ---

interface AffiliateItem {
  item_id?: string;
  item_title?: string;
  item_subtitle?: string;
  item_url?: string;
  item_image?: string;
  author?: string[];
  tradition?: string;
  duration?: string;
}

// --- Client ---

export class AffiliatesClient {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Fetch relevant items from across the Gloo affiliate publisher network.
   * No collection or tenant required — results span the full affiliate network.
   * @param query - The user's query or topic
   * @param itemCount - Maximum number of items to return
   */
  async getReferencedItems(
    query: string,
    itemCount: number = DEFAULT_ITEM_COUNT
  ): Promise<AffiliateItem[]> {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post<AffiliateItem[]>(
        AFFILIATES_URL,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
      throw new Error(`Affiliates request failed: ${error.message}`);
    }
  }
}

// --- Runner ---

async function run(
  query: string,
  itemCount: number = DEFAULT_ITEM_COUNT
): Promise<void> {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const client = new AffiliatesClient(tokenManager);

  console.log(`Fetching affiliate recommendations for: '${query}'`);
  console.log(`Searching across the Gloo affiliate network...`);
  console.log(`Requesting up to ${itemCount} items\n`);

  const items = await client.getReferencedItems(query, itemCount);

  if (!items || items.length === 0) {
    console.log("No affiliate items found.");
    return;
  }

  console.log(`Found ${items.length} item(s) from across the affiliate network:\n`);

  items.forEach((item, i) => {
    console.log(`--- Item ${i + 1} ---`);
    console.log(`Title:     ${item.item_title || "N/A"}`);

    if (item.author?.length) console.log(`Author:    ${item.author.join(", ")}`);
    if (item.tradition) console.log(`Tradition: ${item.tradition}`);
    if (item.item_subtitle) console.log(`Subtitle:  ${item.item_subtitle}`);
    if (item.item_url) console.log(`URL:       ${item.item_url}`);
    console.log();
  });
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npx ts-node recommend-affiliates.ts <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find resources for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  npx ts-node recommend-affiliates.ts "How do I deal with anxiety?"');
  console.log('  npx ts-node recommend-affiliates.ts "parenting teenagers" 3');
}

async function main(): Promise<void> {
  validateCredentials(CLIENT_ID, CLIENT_SECRET);

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
