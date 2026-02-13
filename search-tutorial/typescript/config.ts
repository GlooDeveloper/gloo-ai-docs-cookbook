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

export const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
export const SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";
export const COMPLETIONS_URL =
  "https://platform.ai.gloo.com/ai/v2/chat/completions";

export const PORT = parseEnvInt(process.env.PORT, 3000);

export const RAG_MAX_TOKENS = parseEnvInt(process.env.RAG_MAX_TOKENS, 3000);
export const RAG_CONTEXT_MAX_SNIPPETS = parseEnvInt(
  process.env.RAG_CONTEXT_MAX_SNIPPETS,
  5
);
export const RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = parseEnvInt(
  process.env.RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
  350
);
