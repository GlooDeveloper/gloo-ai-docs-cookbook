/**
 * Shared configuration for JavaScript tutorial scripts and server.
 */

require("dotenv").config();

const API_KEY = process.env.GLOO_API_KEY || "";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

const SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";
const COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions";

const PORT = process.env.PORT || 3000;

const RAG_MAX_TOKENS = parseInt(process.env.RAG_MAX_TOKENS || "3000", 10);
const RAG_CONTEXT_MAX_SNIPPETS = parseInt(
  process.env.RAG_CONTEXT_MAX_SNIPPETS || "5",
  10
);
const RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = parseInt(
  process.env.RAG_CONTEXT_MAX_CHARS_PER_SNIPPET || "350",
  10
);

function validateApiKey(apiKey) {
  if (!apiKey) {
    console.error("Error: GLOO_API_KEY must be set");
    console.log("Create a .env file with your API key:");
    console.log("GLOO_API_KEY=your_api_key_here");
    console.log("GLOO_TENANT=your_tenant_name_here");
    process.exit(1);
  }
}

module.exports = {
  API_KEY,
  TENANT,
  SEARCH_URL,
  COMPLETIONS_URL,
  PORT,
  RAG_MAX_TOKENS,
  RAG_CONTEXT_MAX_SNIPPETS,
  RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
  validateApiKey,
};
