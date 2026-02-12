/**
 * Gloo AI Search API - Authentication
 *
 * OAuth2 token management for Gloo AI API authentication.
 */

const axios = require("axios");

class TokenManager {
  constructor(clientId, clientSecret, tokenUrl) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenUrl = tokenUrl;
    this.tokenInfo = {};
  }

  async getAccessToken() {
    const body = "grant_type=client_credentials&scope=api/access";
    const response = await axios.post(this.tokenUrl, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: this.clientId, password: this.clientSecret },
    });
    const tokenData = response.data;
    tokenData.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    this.tokenInfo = tokenData;
    return tokenData;
  }

  isTokenExpired() {
    if (!this.tokenInfo || !this.tokenInfo.expires_at) return true;
    return Date.now() / 1000 > this.tokenInfo.expires_at - 60;
  }

  async ensureValidToken() {
    if (this.isTokenExpired()) {
      await this.getAccessToken();
    }
    return this.tokenInfo.access_token;
  }
}

function validateCredentials(clientId, clientSecret) {
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

module.exports = { TokenManager, validateCredentials };
