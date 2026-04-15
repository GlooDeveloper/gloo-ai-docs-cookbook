/**
 * Shared configuration for JavaScript recommendation scripts and server.
 */

require("dotenv").config();

const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";
const COLLECTION = process.env.GLOO_COLLECTION || "GlooProd";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const RECOMMENDATIONS_BASE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base";
const RECOMMENDATIONS_VERBOSE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose";
const AFFILIATES_URL =
  "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DEFAULT_ITEM_COUNT = parseInt(process.env.DEFAULT_ITEM_COUNT || "5", 10);

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT,
  COLLECTION,
  TOKEN_URL,
  RECOMMENDATIONS_BASE_URL,
  RECOMMENDATIONS_VERBOSE_URL,
  AFFILIATES_URL,
  PORT,
  DEFAULT_ITEM_COUNT,
};
