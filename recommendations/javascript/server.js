/**
 * Gloo AI Recommendations API - Proxy Server
 *
 * A lightweight Express server that proxies recommendation requests to the Gloo AI API.
 * The frontend calls this server instead of the Gloo API directly,
 * keeping credentials secure on the server side.
 *
 * Endpoints:
 *   POST /api/recommendations/base       - Publisher-scoped recommendations (metadata only)
 *   POST /api/recommendations/verbose    - Publisher-scoped recommendations (with snippet text)
 *   POST /api/recommendations/affiliates - Cross-publisher affiliate network recommendations
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { TokenManager, validateCredentials } = require("./auth");
const { RecommendationsClient } = require("./recommend-base");
const { VerboseRecommendationsClient } = require("./recommend-verbose");
const { AffiliatesClient } = require("./recommend-affiliates");
const {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  PORT,
  DEFAULT_ITEM_COUNT,
} = require("./config");

// Validate credentials on startup
validateCredentials(CLIENT_ID, CLIENT_SECRET);

// Shared token manager and API clients
const tokenManager = new TokenManager(CLIENT_ID, CLIENT_SECRET, TOKEN_URL);
const baseClient = new RecommendationsClient(tokenManager);
const verboseClient = new VerboseRecommendationsClient(tokenManager);
const affiliatesClient = new AffiliatesClient(tokenManager);

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend
app.use(
  express.static(path.join(__dirname, "../frontend-example/simple-html"))
);

/**
 * POST /api/recommendations/base
 * Publisher-scoped recommendations without snippet text.
 */
app.post("/api/recommendations/base", async (req, res) => {
  const { query, item_count } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Field 'query' is required" });
  }

  const itemCount = Math.max(
    1,
    Math.min(parseInt(item_count, 10) || DEFAULT_ITEM_COUNT, 50)
  );

  try {
    const items = await baseClient.getBase(query, itemCount);
    res.json(items);
  } catch (error) {
    console.error("Base recommendations error:", error.message);
    res.status(500).json({ error: "Base recommendations request failed" });
  }
});

/**
 * POST /api/recommendations/verbose
 * Publisher-scoped recommendations with full snippet text.
 */
app.post("/api/recommendations/verbose", async (req, res) => {
  const { query, item_count } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Field 'query' is required" });
  }

  const itemCount = Math.max(
    1,
    Math.min(parseInt(item_count, 10) || DEFAULT_ITEM_COUNT, 50)
  );

  try {
    const items = await verboseClient.getVerbose(query, itemCount);
    res.json(items);
  } catch (error) {
    console.error("Verbose recommendations error:", error.message);
    res.status(500).json({ error: "Verbose recommendations request failed" });
  }
});

/**
 * POST /api/recommendations/affiliates
 * Cross-publisher affiliate network recommendations.
 */
app.post("/api/recommendations/affiliates", async (req, res) => {
  const { query, item_count } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Field 'query' is required" });
  }

  const itemCount = Math.max(
    1,
    Math.min(parseInt(item_count, 10) || DEFAULT_ITEM_COUNT, 50)
  );

  try {
    const items = await affiliatesClient.getReferencedItems(query, itemCount);
    res.json(items);
  } catch (error) {
    console.error("Affiliates error:", error.message);
    res.status(500).json({ error: "Affiliates request failed" });
  }
});

app.listen(PORT, () => {
  console.log(
    `Recommendations API proxy server running at http://localhost:${PORT}`
  );
  console.log(`Frontend available at http://localhost:${PORT}`);
  console.log(`\nAPI endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/recommendations/base`);
  console.log(`  POST http://localhost:${PORT}/api/recommendations/verbose`);
  console.log(`  POST http://localhost:${PORT}/api/recommendations/affiliates`);
});
