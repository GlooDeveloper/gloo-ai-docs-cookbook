/**
 * Gloo AI Recommendations API - Verbose Recommendations
 *
 * Fetches publisher-scoped item recommendations with full snippet text included —
 * useful for displaying a content preview or pull-quote to drive engagement.
 *
 * Usage:
 *   node recommend-verbose.js <query> [item_count]
 *
 * Examples:
 *   node recommend-verbose.js "How do I deal with anxiety?"
 *   node recommend-verbose.js "parenting teenagers" 3
 */

const axios = require("axios");
const { TokenManager, validateCredentials } = require("./auth");
const {
  CLIENT_ID,
  CLIENT_SECRET,
  COLLECTION,
  TENANT,
  TOKEN_URL,
  RECOMMENDATIONS_VERBOSE_URL,
  DEFAULT_ITEM_COUNT,
} = require("./config");

const SNIPPET_PREVIEW_CHARS = 200;

class VerboseRecommendationsClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Fetch publisher-scoped recommendations with full snippet text.
   * @param {string} query - The user's query or topic
   * @param {number} itemCount - Maximum number of items to return
   * @returns {Array} List of recommended items including snippet text
   */
  async getVerbose(query, itemCount = DEFAULT_ITEM_COUNT) {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      collection: COLLECTION,
      tenant: TENANT,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post(RECOMMENDATIONS_VERBOSE_URL, payload, {
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
          `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`Verbose recommendations request failed: ${error.message}`);
    }
  }
}

async function run(query, itemCount = DEFAULT_ITEM_COUNT) {
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

    const authors = item.author || [];
    if (authors.length) console.log(`Author: ${authors.join(", ")}`);

    // uuids holds matched snippets — verbose includes the full snippet text
    const uuids = item.uuids || [];
    if (uuids.length) {
      const top = uuids[0];
      console.log(`Relevance: ${(top.certainty || 0).toFixed(2)}`);
      if (top.ai_title) console.log(`Section:   ${top.ai_title}`);

      // snippet is the key difference from the base endpoint
      const snippet = top.snippet || "";
      if (snippet) {
        const preview = snippet.substring(0, SNIPPET_PREVIEW_CHARS);
        const ellipsis = snippet.length > SNIPPET_PREVIEW_CHARS ? "..." : "";
        console.log(`Preview:   "${preview}${ellipsis}"`);
      }
    }

    if (item.item_url) console.log(`URL:    ${item.item_url}`);
    console.log();
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  node recommend-verbose.js <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find recommendations for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  node recommend-verbose.js "How do I deal with anxiety?"');
  console.log('  node recommend-verbose.js "parenting teenagers" 3');
}

async function main() {
  validateCredentials(CLIENT_ID, CLIENT_SECRET);

  const args = process.argv.slice(2);
  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const query = args[0];
  const itemCount = args[1]
    ? Math.max(1, Math.min(parseInt(args[1], 10) || DEFAULT_ITEM_COUNT, 50))
    : DEFAULT_ITEM_COUNT;

  try {
    await run(query, itemCount);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use by server.js
module.exports = { VerboseRecommendationsClient };

// Run if executed directly
if (require.main === module) {
  main();
}
