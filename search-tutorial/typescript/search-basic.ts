/**
 * Gloo AI Search API - Basic TypeScript Example
 *
 * This script demonstrates how to use the Gloo AI Search API
 * to perform semantic search on your ingested content.
 */

import axios from "axios";
import dotenv from "dotenv";
import { TokenManager, validateCredentials } from "./auth";

dotenv.config();

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";

// --- Types ---
interface SearchMetadata {
  distance: number;
  certainty: number;
  score: number;
  creation_time: string;
  last_update_time: string;
}

interface SearchProperties {
  item_title: string;
  type: string;
  author: string[];
  snippet: string;
  summaries?: Record<string, string>;
  biblical_analysis?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SearchResult {
  uuid: string;
  metadata: SearchMetadata;
  properties: SearchProperties;
  collection: string;
}

interface SearchResponse {
  data: SearchResult[];
  intent: number;
}

export class SearchClient {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  async search(query: string, limit: number = 10): Promise<SearchResponse> {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      collection: "GlooProd",
      tenant: TENANT,
      limit,
      certainty: 0.5,
    };

    try {
      const response = await axios.post<SearchResponse>(SEARCH_URL, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error(
          `Search failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`Search request failed: ${error.message}`);
    }
  }
}

async function basicSearch(query: string, limit: number = 10): Promise<void> {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const searchClient = new SearchClient(tokenManager);

  console.log(`Searching for: '${query}'`);
  console.log(`Limit: ${limit} results\n`);

  const results = await searchClient.search(query, limit);

  if (!results.data || results.data.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log(`Found ${results.data.length} results:\n`);

  results.data.forEach((result, i) => {
    const props = result.properties;
    const metadata = result.metadata;

    console.log(`--- Result ${i + 1} ---`);
    console.log(`Title: ${props.item_title || "N/A"}`);
    console.log(`Type: ${props.type || "N/A"}`);
    console.log(`Author: ${(props.author || ["N/A"]).join(", ")}`);
    console.log(`Relevance Score: ${(metadata.certainty || 0).toFixed(4)}`);

    if (props.snippet) {
      console.log(`Snippet: ${props.snippet.substring(0, 200)}...`);
    }

    console.log();
  });
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npx ts-node search-basic.ts <query> [limit]");
  console.log();
  console.log("Examples:");
  console.log('  npx ts-node search-basic.ts "How can I know my purpose?"');
  console.log('  npx ts-node search-basic.ts "purpose" 5');
}

async function main(): Promise<void> {
  validateCredentials(CLIENT_ID, CLIENT_SECRET);

  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const query = args[0];
  const limit = args[1] ? parseInt(args[1], 10) : 10;

  try {
    await basicSearch(query, limit);
  } catch (error: any) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
  }
}

// Export for use by server
export { TOKEN_URL, SEARCH_URL, CLIENT_ID, CLIENT_SECRET, TENANT };

// Run if executed directly
if (require.main === module) {
  main();
}
