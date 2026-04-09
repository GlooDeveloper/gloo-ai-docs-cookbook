/**
 * Gloo AI Recommendations API - Base Recommendations
 *
 * Fetches publisher-scoped item recommendations with snippet metadata
 * but without snippet text — ideal for a clean recommendations list.
 *
 * Usage:
 *   node recommend-base.js <query> [item_count]
 *
 * Examples:
 *   node recommend-base.js "How do I deal with anxiety?"
 *   node recommend-base.js "parenting teenagers" 3
 */

const axios = require("axios");
const { TokenManager, validateCredentials } = require("./auth");
const {
  CLIENT_ID,
  CLIENT_SECRET,
  COLLECTION,
  TENANT,
  TOKEN_URL,
  RECOMMENDATIONS_BASE_URL,
  DEFAULT_ITEM_COUNT,
} = require("./config");

class RecommendationsClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Fetch publisher-scoped recommendations (metadata only, no snippet text).
   * @param {string} query - The user's query or topic
   * @param {number} itemCount - Maximum number of items to return
   * @returns {Array} List of recommended items with metadata
   */
  async getBase(query, itemCount = DEFAULT_ITEM_COUNT) {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      collection: COLLECTION,
      tenant: TENANT,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post(RECOMMENDATIONS_BASE_URL, payload, {
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
      throw new Error(`Recommendations request failed: ${error.message}`);
    }
  }
}

async function run(query, itemCount = DEFAULT_ITEM_COUNT) {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const client = new RecommendationsClient(tokenManager);

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

    const authors = item.author || [];
    if (authors.length) console.log(`Author: ${authors.join(", ")}`);

    // uuids holds the matched snippets with relevance scores
    const uuids = item.uuids || [];
    if (uuids.length) {
      const top = uuids[0];
      console.log(`Relevance: ${(top.certainty || 0).toFixed(2)}`);
      if (top.ai_title) console.log(`Section:   ${top.ai_title}`);
      if (top.item_summary) {
        console.log(`Summary:   ${top.item_summary.substring(0, 200)}`);
      }
    }

    if (item.item_url) console.log(`URL:    ${item.item_url}`);
    console.log();
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  node recommend-base.js <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find recommendations for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  node recommend-base.js "How do I deal with anxiety?"');
  console.log('  node recommend-base.js "parenting teenagers" 3');
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
module.exports = { RecommendationsClient };

// Run if executed directly
if (require.main === module) {
  main();
}
