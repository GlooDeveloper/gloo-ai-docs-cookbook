#!/usr/bin/env node

/**
 * Gloo AI Completions V2 Tutorial - JavaScript
 *
 * This example demonstrates how to use the Gloo AI Completions V2 API
 * with its three routing strategies: auto-routing, model family selection,
 * and direct model selection.
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

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
 * Example 1: Auto-routing - Let Gloo AI select the optimal model
 */
async function makeV2AutoRouting(message, tradition = "evangelical") {
    const token = await ensureValidToken();

    const payload = {
        messages: [{ role: "user", content: message }],
        auto_routing: true,
        tradition: tradition
    };

    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error("Error making auto-routing request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Example 2: Model family selection - Choose a provider family
 */
async function makeV2ModelFamily(message, modelFamily = "anthropic") {
    const token = await ensureValidToken();

    const payload = {
        messages: [{ role: "user", content: message }],
        model_family: modelFamily
    };

    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error("Error making model family request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Example 3: Direct model selection - Specify an exact model
 */
async function makeV2DirectModel(message, model = "gloo-anthropic-claude-sonnet-4.5") {
    const token = await ensureValidToken();

    const payload = {
        messages: [{ role: "user", content: message }],
        model: model,
        temperature: 0.7,
        max_tokens: 500
    };

    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error("Error making direct model request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Test the Completions V2 API with all three routing strategies
 */
async function testCompletionsV2API() {
    console.log("=== Gloo AI Completions V2 API Test ===\n");

    try {
        // Example 1: Auto-routing
        console.log("Example 1: Auto-Routing");
        console.log("Testing: How does the Old Testament connect to the New Testament?");
        const result1 = await makeV2AutoRouting("How does the Old Testament connect to the New Testament?");
        console.log(`   Model used: ${result1.model || 'N/A'}`);
        console.log(`   Routing: ${result1.routing_mechanism || 'N/A'}`);
        console.log(`   Response: ${result1.choices[0].message.content.substring(0, 100)}...`);
        console.log("   ✓ Auto-routing test passed\n");

        // Example 2: Model family selection
        console.log("Example 2: Model Family Selection");
        console.log("Testing: Draft a short sermon outline on forgiveness.");
        const result2 = await makeV2ModelFamily("Draft a short sermon outline on forgiveness.", "anthropic");
        console.log(`   Model used: ${result2.model || 'N/A'}`);
        console.log(`   Response: ${result2.choices[0].message.content.substring(0, 100)}...`);
        console.log("   ✓ Model family test passed\n");

        // Example 3: Direct model selection
        console.log("Example 3: Direct Model Selection");
        console.log("Testing: Summarize the book of Romans in 3 sentences.");
        const result3 = await makeV2DirectModel("Summarize the book of Romans in 3 sentences.");
        console.log(`   Model used: ${result3.model || 'N/A'}`);
        console.log(`   Response: ${result3.choices[0].message.content.substring(0, 100)}...`);
        console.log("   ✓ Direct model test passed\n");

        console.log("=== All Completions V2 tests passed! ===");
        return true;

    } catch (error) {
        console.error("✗ Test failed:", error.message);
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

    await testCompletionsV2API();
}

// Export functions for use in other modules
module.exports = {
    getAccessToken,
    isTokenExpired,
    ensureValidToken,
    makeV2AutoRouting,
    makeV2ModelFamily,
    makeV2DirectModel,
    testCompletionsV2API
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
