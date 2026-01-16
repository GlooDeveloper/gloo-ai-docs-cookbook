#!/usr/bin/env node

/**
 * Gloo AI Authentication Tutorial - JavaScript
 * 
 * This example demonstrates how to authenticate with the Gloo AI API
 * using OAuth2 client credentials flow.
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions";

// Global token storage
let tokenInfo = {};

/**
 * Retrieve a new access token from the Gloo AI API
 */
async function getAccessToken() {
    try {
        const body = 'grant_type=client_credentials&scope=api/access';
        const response = await axios.post(TOKEN_URL, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: { username: CLIENT_ID, password: CLIENT_SECRET }
        });
        
        const tokenData = response.data;
        tokenData.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
        
        return tokenData;
    } catch (error) {
        console.error("Error getting access token:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Check if the token is expired or close to expiring
 */
function isTokenExpired(token) {
    if (!token || !token.expires_at) return true;
    return (Date.now() / 1000) > (token.expires_at - 60);
}

/**
 * Ensure we have a valid access token
 */
async function ensureValidToken() {
    if (isTokenExpired(tokenInfo)) {
        console.log("Getting new access token...");
        tokenInfo = await getAccessToken();
    }
    return tokenInfo.access_token;
}

/**
 * Make an authenticated API request
 */
async function makeAuthenticatedRequest(endpoint, payload = null) {
    const token = await ensureValidToken();
    
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (payload) {
        const response = await axios.post(endpoint, payload, config);
        return response.data;
    } else {
        const response = await axios.get(endpoint, config);
        return response.data;
    }
}

/**
 * Test the authentication implementation
 */
async function testAuthentication() {
    console.log("=== Gloo AI Authentication Test ===\n");
    
    try {
        // Test 1: Token retrieval
        console.log("1. Testing token retrieval...");
        const tokenInfo = await getAccessToken();
        console.log("   ✓ Token retrieved successfully");
        console.log(`   Token type: ${tokenInfo.token_type}`);
        console.log(`   Expires in: ${tokenInfo.expires_in} seconds\n`);
        
        // Test 2: Token validation
        console.log("2. Testing token validation...");
        const token = await ensureValidToken();
        console.log("   ✓ Token validation successful\n");
        
        // Test 3: API call with authentication
        console.log("3. Testing authenticated API call...");
        const result = await makeAuthenticatedRequest(API_URL, {
            model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
            messages: [{ role: "user", content: "Hello! This is a test of the authentication system." }]
        });
        
        console.log("   ✓ API call successful");
        console.log(`   Response: ${result.choices[0].message.content.substring(0, 100)}...\n`);
        
        console.log("=== All tests passed! ===");
        return true;
        
    } catch (error) {
        console.error("✗ Authentication test failed:", error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main() {
    if (CLIENT_ID === "YOUR_CLIENT_ID" || CLIENT_SECRET === "YOUR_CLIENT_SECRET") {
        console.log("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
        console.log("You can create a .env file with:");
        console.log("GLOO_CLIENT_ID=your_client_id");
        console.log("GLOO_CLIENT_SECRET=your_client_secret");
        return;
    }
    
    await testAuthentication();
}

// Run the main function
main();