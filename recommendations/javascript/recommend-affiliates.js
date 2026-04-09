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
 *   node recommend-affiliates.js <query> [item_count]
 *
 * Examples:
 *   node recommend-affiliates.js "How do I deal with anxiety?"
 *   node recommend-affiliates.js "parenting teenagers" 3
 */

const axios = require("axios");
const { TokenManager, validateCredentials } = require("./auth");
const {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  AFFILIATES_URL,
  DEFAULT_ITEM_COUNT,
} = require("./config");

class AffiliatesClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Fetch relevant items from across the Gloo affiliate publisher network.
   * No collection or tenant required — results span the full affiliate network.
   * @param {string} query - The user's query or topic
   * @param {number} itemCount - Maximum number of items to return
   * @returns {Array} List of affiliate items from across the network
   */
  async getReferencedItems(query, itemCount = DEFAULT_ITEM_COUNT) {
    const token = await this.tokenManager.ensureValidToken();

    const payload = {
      query,
      item_count: itemCount,
      certainty_threshold: 0.75,
    };

    try {
      const response = await axios.post(AFFILIATES_URL, payload, {
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
      throw new Error(`Affiliates request failed: ${error.message}`);
    }
  }
}

async function run(query, itemCount = DEFAULT_ITEM_COUNT) {
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

    const authors = item.author || [];
    if (authors.length) console.log(`Author:    ${authors.join(", ")}`);

    if (item.tradition) console.log(`Tradition: ${item.tradition}`);
    if (item.item_subtitle) console.log(`Subtitle:  ${item.item_subtitle}`);
    if (item.item_url) console.log(`URL:       ${item.item_url}`);
    console.log();
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  node recommend-affiliates.js <query> [item_count]");
  console.log();
  console.log("Arguments:");
  console.log("  query       Topic or question to find resources for (required)");
  console.log("  item_count  Max items to return (optional, default: 5)");
  console.log();
  console.log("Examples:");
  console.log('  node recommend-affiliates.js "How do I deal with anxiety?"');
  console.log('  node recommend-affiliates.js "parenting teenagers" 3');
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
module.exports = { AffiliatesClient };

// Run if executed directly
if (require.main === module) {
  main();
}
