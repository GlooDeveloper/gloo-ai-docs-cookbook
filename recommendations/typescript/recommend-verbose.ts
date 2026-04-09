/**
 * Gloo AI Recommendations API - Verbose Recommendations
 *
 * Fetches publisher-scoped item recommendations with full snippet text included —
 * useful for displaying a content preview or pull-quote to drive engagement.
 *
 * Usage:
 *   npx ts-node recommend-verbose.ts <query> [item_count]
 *
 * Examples:
 *   npx ts-node recommend-verbose.ts "How do I deal with anxiety?"
 *   npx ts-node recommend-verbose.ts "parenting teenagers" 3
 */

import axios from "axios";
import { TokenManager, validateCredentials } from "./auth";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  COLLECTION,
  TENANT,
  TOKEN_URL,
  RECOMMENDATIONS_VERBOSE_URL,
  DEFAULT_ITEM_COUNT,
} from "./config";

// --- Types ---

interface SnippetUuidVerbose {
  uuid: string;
  ai_title?: string;
  ai_subtitle?: string;
  item_summary?: string;
  time_start?: string;
  time_end?: string;
  part?: number;
  certainty?: number;
  snippet?: string; // present only in verbose responses
}

interface RecommendationItemVerbose {
  item_id?: string;
  item_title?: string;
  item_subtitle?: string;
  item_url?: string;
  item_image?: string;
  author?: string[];
  tradition?: string;
  duration?: string;
  uuids?: SnippetUuidVerbose[];
}

// --- Client ---

const SNIPPET_PREVIEW_CHARS = 200;

export class VerboseRecommendationsClient {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Fetch publisher-scoped recommendations with full snippet text.
   * @param query - The user's query or topic
   * @param itemCount - Maximum number of items to return
   */
  async getVerbose(
    query: string,
    itemCount: number = DEFAULT_ITEM_COUNT
  ): Promise<RecommendationItemVerbose[]> {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      collection: COLLECTION,
      tenant: TENANT,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post<RecommendationItemVerbose[]>(
        RECOMMENDATIONS_VERBOSE_URL,
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
      throw new Error(`Verbose recommendations request failed: ${error.message}`);
    }
  }
}

// --- Runner ---

async function run(
  query: string,
  itemCount: number = DEFAULT_ITEM_COUNT
): Promise<void> {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const client = new VerboseRecommendationsClient(tokenManager);

  console.log(`Fetching recommendations (with previews) for: '${query}'`);
  console.log(`Requesting up to ${itemCount} items\n`);

  const items = await client.getVerbose(query, itemCount);

  if (!items || items.length === 0) {
    console.log("No recommendations found.");
    return;
  }

  console.log(`Found ${items.length} recommended item(s):\n`);

  items.forEach((item, i) => {
    console.log(`--- Item ${i + 1} ---`);
    console.log(`Title:  ${item.item_title || "N/A"}`);

    if (item.author?.length) console.log(`Author: ${item.author.join(", ")}`);

    // uuids holds matched snippets — verbose includes the full snippet text
    const top = item.uuids?.[0];
    if (top) {
      console.log(`Relevance: ${(top.certainty ?? 0).toFixed(2)}`);
      if (top.ai_title) console.log(`Section:   ${top.ai_title}`);

      // snippet is the key difference from the base endpoint
      if (top.snippet) {
        const preview = top.snippet.substring(0, SNIPPET_PREVIEW_CHARS);
        const ellipsis = top.snippet.length > SNIPPET_PREVIEW_CHARS ? "..." : "";
        console.log(`Preview:   "${preview}${ellipsis}"`);
      }
    }

    if (item.item_url) console.log(`URL:    ${item.item_url}`);
    console.log();
  });
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npx ts-node recommend-verbose.ts <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find recommendations for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  npx ts-node recommend-verbose.ts "How do I deal with anxiety?"');
  console.log('  npx ts-node recommend-verbose.ts "parenting teenagers" 3');
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
