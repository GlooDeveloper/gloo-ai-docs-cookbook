#!/usr/bin/env tsx

/**
 * Gloo AI Authentication Tutorial - TypeScript
 * 
 * This example demonstrates how to authenticate with the Gloo AI API
 * using OAuth2 client credentials flow with full TypeScript support.
 */

import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions";

// Type definitions
interface TokenInfo {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
}

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}

// Global token storage
let tokenInfo: TokenInfo | null = null;

/**
 * Retrieve a new access token from the Gloo AI API
 */
async function getAccessToken(): Promise<TokenInfo> {
    try {
        const body = 'grant_type=client_credentials&scope=api/access';
        const response: AxiosResponse<TokenInfo> = await axios.post(TOKEN_URL, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: { username: CLIENT_ID, password: CLIENT_SECRET }
        });
        
        const tokenData = response.data;
        (tokenData as any).expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
        
        return tokenData;
    } catch (error: any) {
        console.error("Error getting access token:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Check if the token is expired or close to expiring
 */
function isTokenExpired(token: TokenInfo | null): boolean {
    if (!token || !(token as any).expires_at) return true;
    return (Date.now() / 1000) > ((token as any).expires_at - 60);
}

/**
 * Ensure we have a valid access token
 */
async function ensureValidToken(): Promise<string> {
    if (isTokenExpired(tokenInfo)) {
        console.log("Getting new access token...");
        tokenInfo = await getAccessToken();
    }
    return tokenInfo!.access_token;
}

/**
 * Make an authenticated API request
 */
async function makeAuthenticatedRequest<T = any>(endpoint: string, payload?: any): Promise<T> {
    const token = await ensureValidToken();
    
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (payload) {
        const response: AxiosResponse<T> = await axios.post(endpoint, payload, config);
        return response.data;
    } else {
        const response: AxiosResponse<T> = await axios.get(endpoint, config);
        return response.data;
    }
}

/**
 * Test the authentication implementation
 */
async function testAuthentication(): Promise<boolean> {
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
        const request: ChatCompletionRequest = {
            model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
            messages: [{ role: "user", content: "Hello! This is a test of the authentication system." }]
        };
        
        const result = await makeAuthenticatedRequest<ChatCompletionResponse>(API_URL, request);
        
        console.log("   ✓ API call successful");
        console.log(`   Response: ${result.choices[0].message.content.substring(0, 100)}...\n`);
        
        console.log("=== All tests passed! ===");
        return true;
        
    } catch (error: any) {
        console.error("✗ Authentication test failed:", error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    if (CLIENT_ID === "YOUR_CLIENT_ID" || CLIENT_SECRET === "YOUR_CLIENT_SECRET") {
        console.log("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
        console.log("You can create a .env file with:");
        console.log("GLOO_CLIENT_ID=your_client_id");
        console.log("GLOO_CLIENT_SECRET=your_client_secret");
        return;
    }
    
    await testAuthentication();
}

// Export functions for use in other modules
export {
    TokenInfo,
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    getAccessToken,
    isTokenExpired,
    ensureValidToken,
    makeAuthenticatedRequest
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}