package com.gloo.tutorial.search;

import io.github.cdimascio.dotenv.Dotenv;

final class AppConfig {
    private static final Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

    static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    static final String TENANT = dotenv.get("GLOO_TENANT", "your-tenant-name");

    static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    static final String SEARCH_URL = "https://platform.ai.gloo.com/ai/data/v1/search";
    static final String COMPLETIONS_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    static final int RAG_MAX_TOKENS = parseIntOrDefault(dotenv.get("RAG_MAX_TOKENS"), 3000);
    static final int RAG_CONTEXT_MAX_SNIPPETS = parseIntOrDefault(dotenv.get("RAG_CONTEXT_MAX_SNIPPETS"), 5);
    static final int RAG_CONTEXT_MAX_CHARS_PER_SNIPPET = parseIntOrDefault(
            dotenv.get("RAG_CONTEXT_MAX_CHARS_PER_SNIPPET"), 350);

    private AppConfig() {
    }

    static int normalizeLimit(int value, int fallback, int min, int max) {
        if (value <= 0) value = fallback;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    static int parseIntOrDefault(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
