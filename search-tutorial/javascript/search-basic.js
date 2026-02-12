/**
 * Gloo AI Search API - Basic JavaScript Example
 *
 * This script demonstrates how to use the Gloo AI Search API
 * to perform semantic search on your ingested content.
 */

const axios = require("axios");
require("dotenv").config();
const { TokenManager, validateCredentials } = require("./auth");

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";

class SearchClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Perform a semantic search query.
   * @param {string} query - The search query string
   * @param {number} limit - Maximum number of results (10-100 recommended)
   * @returns {object} Search results
   */
  async search(query, limit = 10) {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      collection: "GlooProd",
      tenant: TENANT,
      limit,
      certainty: 0.5,
    };

    try {
      const response = await axios.post(SEARCH_URL, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error(
          `Search failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`Search request failed: ${error.message}`);
    }
  }
}

/**
 * Perform a basic search and display results.
 */
async function basicSearch(query, limit = 10) {
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
    const props = result.properties || {};
    const metadata = result.metadata || {};

    console.log(`--- Result ${i + 1} ---`);
    console.log(`Title: ${props.item_title || "N/A"}`);
    console.log(`Type: ${props.type || "N/A"}`);
    console.log(`Author: ${(props.author || ["N/A"]).join(", ")}`);
    console.log(`Relevance Score: ${(metadata.certainty || 0).toFixed(4)}`);

    const snippet = props.snippet || "";
    if (snippet) {
      console.log(`Snippet: ${snippet.substring(0, 200)}...`);
    }

    console.log();
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  node search-basic.js <query> [limit]");
  console.log();
  console.log("Arguments:");
  console.log("  query   Search query string (required)");
  console.log("  limit   Number of results to return (optional, default: 10)");
  console.log();
  console.log("Examples:");
  console.log('  node search-basic.js "How can I know my purpose?"');
  console.log('  node search-basic.js "purpose" 5');
}

async function main() {
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
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
  }
}

// Export for use by server.js
module.exports = { SearchClient, TOKEN_URL, SEARCH_URL, CLIENT_ID, CLIENT_SECRET, TENANT };

// Run if executed directly
if (require.main === module) {
  main();
}
