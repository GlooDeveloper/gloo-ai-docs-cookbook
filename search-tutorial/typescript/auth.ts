/**
 * Gloo AI Search API - Authentication
 *
 * OAuth2 token management for Gloo AI API authentication.
 */

import axios from "axios";

interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

export class TokenManager {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string;
  private tokenInfo: Partial<TokenData> = {};

  constructor(clientId: string, clientSecret: string, tokenUrl: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenUrl = tokenUrl;
  }

  async getAccessToken(): Promise<TokenData> {
    const body = "grant_type=client_credentials&scope=api/access";
    const response = await axios.post(this.tokenUrl, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: this.clientId, password: this.clientSecret },
    });
    const tokenData: TokenData = response.data;
    tokenData.expires_at =
      Math.floor(Date.now() / 1000) + tokenData.expires_in;
    this.tokenInfo = tokenData;
    return tokenData;
  }

  isTokenExpired(): boolean {
    if (!this.tokenInfo?.expires_at) return true;
    return Date.now() / 1000 > this.tokenInfo.expires_at - 60;
  }

  async ensureValidToken(): Promise<string> {
    if (this.isTokenExpired()) {
      await this.getAccessToken();
    }
    return this.tokenInfo.access_token!;
  }
}

export function validateCredentials(
  clientId: string,
  clientSecret: string
): void {
  if (
    !clientId ||
    !clientSecret ||
    clientId === "YOUR_CLIENT_ID" ||
    clientSecret === "YOUR_CLIENT_SECRET"
  ) {
    console.error("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set");
    console.log("Create a .env file with your credentials:");
    console.log("GLOO_CLIENT_ID=your_client_id_here");
    console.log("GLOO_CLIENT_SECRET=your_client_secret_here");
    console.log("GLOO_TENANT=your_tenant_name_here");
    process.exit(1);
  }
}
