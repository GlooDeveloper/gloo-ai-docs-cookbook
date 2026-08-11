import dotenv from "dotenv";

dotenv.config();

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const API_KEY = process.env.GLOO_API_KEY || "";
export const TENANT = process.env.GLOO_TENANT || "your-tenant-name";
export const COLLECTION = process.env.GLOO_COLLECTION || "GlooProd";

export const RECOMMENDATIONS_BASE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base";
export const RECOMMENDATIONS_VERBOSE_URL =
  "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose";
export const AFFILIATES_URL =
  "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items";

export const PORT = parseEnvInt(process.env.PORT, 3000);
export const DEFAULT_ITEM_COUNT = parseEnvInt(
  process.env.DEFAULT_ITEM_COUNT,
  5
);
