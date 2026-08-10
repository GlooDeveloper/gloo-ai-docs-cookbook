import dotenv from "dotenv";

dotenv.config();

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const API_KEY = process.env.GLOO_API_KEY || "";
export const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

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

export function validateApiKey(apiKey: string): void {
  if (!apiKey) {
    console.error("Error: GLOO_API_KEY must be set");
    console.log("Create a .env file with your API key:");
    console.log("GLOO_API_KEY=your_api_key_here");
    console.log("GLOO_TENANT=your_tenant_name_here");
    process.exit(1);
  }
}
