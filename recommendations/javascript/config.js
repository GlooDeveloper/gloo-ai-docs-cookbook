/**
 * Shared configuration for JavaScript recommendation scripts and server.
 */

require("dotenv").config();

const API_KEY = process.env.GLOO_API_KEY || "";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";
const COLLECTION = process.env.GLOO_COLLECTION || "GlooProd";

const RECOMMENDATIONS_BASE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base";
const RECOMMENDATIONS_VERBOSE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose";
const AFFILIATES_URL =
  "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DEFAULT_ITEM_COUNT = parseInt(process.env.DEFAULT_ITEM_COUNT || "5", 10);

module.exports = {
  API_KEY,
  TENANT,
  COLLECTION,
  RECOMMENDATIONS_BASE_URL,
  RECOMMENDATIONS_VERBOSE_URL,
  AFFILIATES_URL,
  PORT,
  DEFAULT_ITEM_COUNT,
};
