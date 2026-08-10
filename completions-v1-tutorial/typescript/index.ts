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
const API_KEY = process.env.GLOO_API_KEY || "YOUR_API_KEY";
const API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions";

// Type definitions
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

/**
 * Make a chat completion request
 */
async function makeChatCompletionRequest(message: string = "How can I be joyful in hard times?"): Promise<ChatCompletionResponse> {
    const payload: ChatCompletionRequest = {
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        messages: [{ role: "user", content: message }]
    };

    try {
        const response: AxiosResponse<ChatCompletionResponse> = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
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
    if (API_KEY === "YOUR_API_KEY") {
        console.log("Please set your GLOO_API_KEY environment variable");
        console.log("You can create a .env file with:");
        console.log("GLOO_API_KEY=your_api_key");
        return;
    }

    await testCompletionsAPI();
}

// Export functions for use in other modules
export {
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    makeChatCompletionRequest,
    testCompletionsAPI
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
