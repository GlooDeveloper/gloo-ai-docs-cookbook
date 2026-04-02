/**
 * Token manager for Gloo AI OAuth2 authentication.
 *
 * Handles client credentials grant type with automatic token refresh.
 * Caches the token in module scope and refreshes it 5 minutes before expiry.
 */

import type { TokenInfo } from "../types.js";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Retrieve an OAuth2 access token from Gloo AI.
 *
 * @returns Promise resolving to a TokenInfo object
 * @throws Error if credentials are missing or the request fails
 */
export async function getAccessToken(): Promise<TokenInfo> {
  const clientId = process.env.GLOO_CLIENT_ID;
  const clientSecret = process.env.GLOO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables."
    );
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: HTTP ${response.status}`);
  }

  return response.json() as Promise<TokenInfo>;
}

/**
 * Ensure we have a valid access token, refreshing if necessary.
 *
 * @returns Promise resolving to a valid access token string
 */
export async function ensureValidToken(): Promise<string> {
  const now = Date.now();

  if (!accessToken || !tokenExpiry || now >= tokenExpiry) {
    const tokenData = await getAccessToken();
    accessToken = tokenData.access_token;
    // Set expiry with 5-minute buffer (expires_in is in seconds)
    const expiresIn = tokenData.expires_in ?? 3600;
    tokenExpiry = now + (expiresIn - 300) * 1000;
  }

  return accessToken;
}
