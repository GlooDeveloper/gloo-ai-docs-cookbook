/**
 * Gloo AI Search API - Advanced JavaScript Example
 *
 * This script demonstrates advanced search features including:
 * - Filtering and pagination
 * - RAG (Retrieval Augmented Generation) helpers
 * - Integration with Completions V2 API
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
const COMPLETIONS_URL =
  "https://platform.ai.gloo.com/ai/v2/chat/completions";

class AdvancedSearchClient {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Perform an advanced semantic search query.
   * @param {string} query - The search query string
   * @param {number} limit - Maximum number of results (10-100 recommended)
   * @param {string} sortBy - Sort method: "relevance" or "certainty"
   * @returns {object} Search results
   */
  async search(query, limit = 10, sortBy = "relevance") {
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

      const results = response.data;

      if (sortBy === "certainty" && results.data) {
        results.data.sort(
          (a, b) =>
            (b.metadata?.certainty || 0) - (a.metadata?.certainty || 0)
        );
      }

      return results;
    } catch (error) {
      if (error.response) {
        console.error(
          `Search failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`Search request failed: ${error.message}`);
    }
  }

  /**
   * Filter search results by content type.
   * @param {object} results - Search results from the API
   * @param {string[]} contentTypes - Content types to include (e.g., ["Article", "Video"])
   * @returns {object} Filtered results
   */
  filterByContentType(results, contentTypes) {
    if (!results.data) return results;

    return {
      ...results,
      data: results.data.filter((result) =>
        contentTypes.includes(result.properties?.type)
      ),
    };
  }
}

class RAGHelper {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Extract and format snippets from search results for RAG.
   * @param {object} results - Search results from the API
   * @param {number} maxSnippets - Maximum number of snippets to extract
   * @param {number} maxCharsPerSnippet - Maximum characters per snippet
   * @returns {object[]} Formatted snippet objects
   */
  extractSnippets(results, maxSnippets = 5, maxCharsPerSnippet = 500) {
    if (!results.data) return [];

    return results.data.slice(0, maxSnippets).map((result) => {
      const props = result.properties || {};
      return {
        text: (props.snippet || "").substring(0, maxCharsPerSnippet),
        title: props.item_title || "N/A",
        type: props.type || "N/A",
        relevance: result.metadata?.certainty || 0,
      };
    });
  }

  /**
   * Format extracted snippets as context for LLM.
   * @param {object[]} snippets - Array of snippet objects
   * @returns {string} Formatted context string
   */
  formatContextForLLM(snippets) {
    return snippets
      .map(
        (snippet, i) =>
          `[Source ${i + 1}: ${snippet.title} (${snippet.type})]\n${snippet.text}\n`
      )
      .join("\n---\n");
  }

  /**
   * Call Completions V2 API with custom context.
   * @param {string} query - User's question
   * @param {string} context - Formatted context from search results
   * @param {string} [systemPrompt] - Optional custom system prompt
   * @returns {string} Generated response text
   */
  async generateWithContext(query, context, systemPrompt) {
    const token = await this.tokenManager.ensureValidToken();

    if (!systemPrompt) {
      systemPrompt =
        "You are a helpful assistant. Answer the user's question based on the " +
        "provided context. If the context doesn't contain relevant information, " +
        "say so honestly.";
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
    ];

    const payload = {
      messages,
      auto_routing: true,
      max_tokens: 1000,
    };

    try {
      const response = await axios.post(COMPLETIONS_URL, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      });

      return response.data.choices?.[0]?.message?.content || "";
    } catch (error) {
      if (error.response) {
        console.error(`Completions API failed: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Completions request failed: ${error.message}`);
    }
  }
}

/**
 * Execute a search with content type filtering.
 */
async function filteredSearch(query, contentTypes, limit = 10) {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const searchClient = new AdvancedSearchClient(tokenManager);

  console.log(`Searching for: '${query}'`);
  console.log(`Content types: ${contentTypes.join(", ")}`);
  console.log(`Limit: ${limit}\n`);

  const results = await searchClient.search(query, limit);
  const filtered = searchClient.filterByContentType(results, contentTypes);

  if (!filtered.data || filtered.data.length === 0) {
    console.log("No results found matching filters.");
    return;
  }

  console.log(`Found ${filtered.data.length} results:\n`);

  filtered.data.forEach((result, i) => {
    const props = result.properties || {};
    console.log(
      `${i + 1}. ${props.item_title || "N/A"} (${props.type || "N/A"})`
    );
  });
}

/**
 * Execute a search and use results for RAG with Completions API.
 */
async function ragSearch(query, limit = 5) {
  const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
  const searchClient = new AdvancedSearchClient(tokenManager);
  const ragHelper = new RAGHelper(tokenManager);

  console.log(`RAG Search for: '${query}'\n`);

  // Step 1: Search for relevant content
  console.log("Step 1: Searching for relevant content...");
  const results = await searchClient.search(query, limit);

  if (!results.data || results.data.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log(`Found ${results.data.length} results\n`);

  // Step 2: Extract and format snippets
  console.log("Step 2: Extracting snippets...");
  const snippets = ragHelper.extractSnippets(results, limit);
  const context = ragHelper.formatContextForLLM(snippets);
  console.log(`Extracted ${snippets.length} snippets\n`);

  // Step 3: Generate response with context
  console.log("Step 3: Generating response with context...\n");
  const response = await ragHelper.generateWithContext(query, context);

  console.log("=== Generated Response ===");
  console.log(response);
  console.log("\n=== Sources Used ===");
  snippets.forEach((snippet) => {
    console.log(`- ${snippet.title} (${snippet.type})`);
  });
}

function printUsage() {
  console.log("Usage:");
  console.log('  node search-advanced.js filter <query> <types> [limit]');
  console.log('  node search-advanced.js rag <query> [limit]');
  console.log();
  console.log("Commands:");
  console.log("  filter    Search with content type filtering");
  console.log("  rag       Search and generate response using RAG");
  console.log();
  console.log("Examples:");
  console.log('  node search-advanced.js filter "purpose" "Article,Video" 10');
  console.log('  node search-advanced.js rag "How can I know my purpose?" 5');
}

async function main() {
  validateCredentials(CLIENT_ID, CLIENT_SECRET);

  const args = process.argv.slice(2);

  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const command = args[0].toLowerCase();
  const query = args[1];

  try {
    if (command === "filter") {
      if (args.length < 3) {
        console.error("Error: Content types required for filter command");
        printUsage();
        process.exit(1);
      }
      const types = args[2].split(",");
      const limit = args[3] ? parseInt(args[3], 10) : 10;
      await filteredSearch(query, types, limit);
    } else if (command === "rag") {
      const limit = args[2] ? parseInt(args[2], 10) : 5;
      await ragSearch(query, limit);
    } else {
      console.error(`Error: Unknown command '${command}'`);
      printUsage();
      process.exit(1);
    }
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
  }
}

// Export for use by server.js
module.exports = {
  AdvancedSearchClient,
  RAGHelper,
  COMPLETIONS_URL,
};

// Run if executed directly
if (require.main === module) {
  main();
}
