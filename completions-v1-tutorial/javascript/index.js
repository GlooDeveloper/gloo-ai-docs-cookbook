#!/usr/bin/env node

/**
 * Gloo AI Completions Tutorial - JavaScript
 * 
 * This example demonstrates how to use the Gloo AI Completions API
 * to generate text completions using the chat/completions endpoint.
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
 * Make a chat completion request
 */
async function makeChatCompletionRequest(message = "How can I be joyful in hard times?") {
    const token = await ensureValidToken();
    
    const payload = {
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        messages: [{ role: "user", content: message }]
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
        console.error("Error making chat completion request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Test the completions API with multiple examples
 */
async function testCompletionsAPI() {
    console.log("=== Gloo AI Completions API Test ===\n");
    
    const testMessages = [
        "How can I be joyful in hard times?",
        "What are the benefits of a positive mindset?",
        "How do I build meaningful relationships?"
    ];
    
    try {
        for (let i = 0; i < testMessages.length; i++) {
            const message = testMessages[i];
            console.log(`Test ${i + 1}: ${message}`);
            
            const completion = await makeChatCompletionRequest(message);
            
            console.log("✓ Completion successful");
            console.log(`Response: ${completion.choices[0].message.content.substring(0, 100)}...`);
            console.log();
        }
        
        console.log("=== All completion tests passed! ===");
        return true;
        
    } catch (error) {
        console.error("✗ Completion test failed:", error.message);
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
    
    await testCompletionsAPI();
}

// Export functions for use in other modules
module.exports = {
    getAccessToken,
    isTokenExpired,
    ensureValidToken,
    makeChatCompletionRequest,
    testCompletionsAPI
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}