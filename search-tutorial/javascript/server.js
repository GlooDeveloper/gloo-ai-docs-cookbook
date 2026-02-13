/**
 * Gloo AI Search API - Proxy Server
 *
 * A lightweight Express server that proxies search requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Endpoints:
 *   GET  /api/search?q=<query>&limit=<limit>  - Basic search
 *   POST /api/search/rag                       - Search + RAG with Completions V2
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { TokenManager, validateCredentials } = require("./auth");
const { SearchClient } = require("./search-basic");
const { AdvancedSearchClient, RAGHelper } = require("./search-advanced");

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const PORT = process.env.PORT || 3000;
const RAG_CONTEXT_MAX_SNIPPETS = parseInt(process.env.RAG_CONTEXT_MAX_SNIPPETS || "5", 10);
const RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = parseInt(
  process.env.RAG_CONTEXT_MAX_CHARS_PER_SNIPPET || "350",
  10
);

// Validate credentials on startup
validateCredentials(CLIENT_ID, CLIENT_SECRET);

// Shared token manager (single instance for the server)
const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
const searchClient = new SearchClient(tokenManager);
const advancedSearchClient = new AdvancedSearchClient(tokenManager);
const ragHelper = new RAGHelper(tokenManager);

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend
app.use(express.static(path.join(__dirname, "../frontend-example/simple-html")));

/**
 * GET /api/search - Basic search endpoint
 */
app.get("/api/search", async (req, res) => {
  const { q, limit = "10" } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    const results = await searchClient.search(q, parseInt(limit, 10));
    res.json(results);
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ error: "Search request failed" });
  }
});

/**
 * POST /api/search/rag - RAG search endpoint
 * Body: { "query": "...", "limit": 5, "systemPrompt": "..." }
 */
app.post("/api/search/rag", async (req, res) => {
  const { query, limit = 5, systemPrompt } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Field 'query' is required" });
  }

  try {
    // Step 1: Search
    const results = await advancedSearchClient.search(query, limit);

    if (!results.data || results.data.length === 0) {
      return res.json({ response: "No relevant content found.", sources: [] });
    }

    // Step 2: Extract snippets and format context
    const snippetLimit = Math.min(limit, RAG_CONTEXT_MAX_SNIPPETS);
    const snippets = ragHelper.extractSnippets(
      results,
      snippetLimit,
      RAG_CONTEXT_MAX_CHARS_PER_SNIPPET
    );
    const context = ragHelper.formatContextForLLM(snippets);

    // Step 3: Generate response
    const generation = await ragHelper.generateWithContext(
      query,
      context,
      systemPrompt
    );
    const generatedResponse = generation.responseText;

    const payload = {
      response: generatedResponse,
      sources: snippets.map((s) => ({ title: s.title, type: s.type })),
    };

    res.json(payload);
  } catch (error) {
    console.error("RAG error:", error.message);
    res.status(500).json({ error: "RAG request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Search API proxy server running at http://localhost:${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
  console.log(`\nAPI endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/search?q=your+query&limit=10`);
  console.log(`  POST http://localhost:${PORT}/api/search/rag`);
});
