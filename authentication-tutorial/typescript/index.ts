#!/usr/bin/env tsx

/**
 * Gloo AI Authentication Tutorial - TypeScript
 *
 * This example demonstrates how to authenticate with the Gloo AI API
 * using API key authentication with full TypeScript support.
 */

import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const API_KEY = process.env.GLOO_API_KEY || "";
const API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions";

// Type definitions
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    auto_routing: boolean;
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

/**
 * Validate that the required API key is configured
 */
function validateCredentials(): boolean {
    if (!API_KEY) {
        console.log("Please set your GLOO_API_KEY environment variable");
        console.log("You can create a .env file with:");
        console.log("GLOO_API_KEY=your_api_key");
        return false;
    }
    return true;
}

/**
 * Make an authenticated API request using the API key
 */
async function makeAuthenticatedRequest<T = any>(endpoint: string, payload?: any): Promise<T> {
    const config = {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
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
        // Test 1: Verify API key is configured
        console.log("1. Verifying API key is configured...");
        if (!validateCredentials()) {
            return false;
        }
        console.log("   API key is set\n");

        // Test 2: API call with authentication
        console.log("2. Testing authenticated API call...");
        const request: ChatCompletionRequest = {
            auto_routing: true,
            messages: [{ role: "user", content: "Hello! This is a test of the authentication system." }]
        };

        const result = await makeAuthenticatedRequest<ChatCompletionResponse>(API_URL, request);

        console.log("   API call successful");
        console.log(`   Response: ${result.choices[0].message.content.substring(0, 100)}...\n`);

        console.log("=== All tests passed! ===");
        return true;

    } catch (error: any) {
        console.error("Authentication test failed:", error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    if (!validateCredentials()) {
        return;
    }

    await testAuthentication();
}

// Export functions for use in other modules
export {
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    validateCredentials,
    makeAuthenticatedRequest
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
