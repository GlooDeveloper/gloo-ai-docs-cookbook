/**
 * Shared configuration for JavaScript tutorial scripts and server.
 */

require("dotenv").config();

const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.GLOO_TENANT || "your-tenant-name";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";
const COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

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

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT,
  TOKEN_URL,
  SEARCH_URL,
  COMPLETIONS_URL,
  PORT,
  RAG_MAX_TOKENS,
  RAG_CONTEXT_MAX_SNIPPETS,
  RAG_CONTEXT_MAX_CHARS_PER_SNIPPET,
};
