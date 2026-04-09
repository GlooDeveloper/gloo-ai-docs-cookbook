import dotenv from "dotenv";

dotenv.config();

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
export const CLIENT_SECRET =
  process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
export const TENANT = process.env.GLOO_TENANT || "your-tenant-name";
export const COLLECTION = process.env.GLOO_COLLECTION || "GlooProd";

export const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
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
