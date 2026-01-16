#!/usr/bin/env tsx

/**
 * Gloo AI Completions Tutorial - TypeScript
 * 
 * This example demonstrates how to use the Gloo AI Completions API
 * to generate text completions using the chat/completions endpoint
 * with full TypeScript support.
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
 * Make a chat completion request
 */
async function makeChatCompletionRequest(message: string = "How can I be joyful in hard times?"): Promise<ChatCompletionResponse> {
    const token = await ensureValidToken();
    
    const payload: ChatCompletionRequest = {
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        messages: [{ role: "user", content: message }]
    };
    
    try {
        const response: AxiosResponse<ChatCompletionResponse> = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error: any) {
        console.error("Error making chat completion request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Test the completions API with multiple examples
 */
async function testCompletionsAPI(): Promise<boolean> {
    console.log("=== Gloo AI Completions API Test ===\n");
    
    const testMessages: string[] = [
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
        
    } catch (error: any) {
        console.error("✗ Completion test failed:", error.message);
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
    
    await testCompletionsAPI();
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
    makeChatCompletionRequest,
    testCompletionsAPI
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}