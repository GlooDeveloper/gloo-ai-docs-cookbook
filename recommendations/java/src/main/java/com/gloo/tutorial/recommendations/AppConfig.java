package com.gloo.tutorial.recommendations;

import io.github.cdimascio.dotenv.Dotenv;

final class AppConfig {
    private static final Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

    static final String CLIENT_ID     = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    static final String TENANT        = dotenv.get("GLOO_TENANT", "your-tenant-name");
    static final String COLLECTION    = dotenv.get("GLOO_COLLECTION", "GlooProd");

    static final String TOKEN_URL                  = "https://platform.ai.gloo.com/oauth2/token";
    static final String RECOMMENDATIONS_BASE_URL    = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/base";
    static final String RECOMMENDATIONS_VERBOSE_URL = "https://platform.ai.gloo.com/ai/v1/data/items/recommendations/verbose";
    static final String AFFILIATES_URL             = "https://platform.ai.gloo.com/ai/v1/data/affiliates/referenced-items";

    static final int DEFAULT_ITEM_COUNT = parseIntOrDefault(dotenv.get("DEFAULT_ITEM_COUNT"), 5);
    static final int PORT               = parseIntOrDefault(dotenv.get("PORT"), 3000);

    private AppConfig() {}

    static int parseIntOrDefault(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    static int parseItemCount(String value, int defaultValue) {
        int n = parseIntOrDefault(value, defaultValue);
        if (n < 1) return defaultValue;
        if (n > 50) return 50;
        return n;
    }
}
