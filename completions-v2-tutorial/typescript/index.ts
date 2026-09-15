#!/usr/bin/env tsx

/**
 * Gloo AI Completions V2 Tutorial - TypeScript
 *
 * This example demonstrates how to use the Gloo AI Completions V2 API
 * with its three routing strategies: auto-routing, model family selection,
 * and direct model selection.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definitions
interface V2CompletionResponse {
    model: string;
    routing_mechanism?: string;
    routing_tier?: string;
    routing_confidence?: number;
    tradition?: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}

// Configuration
const API_KEY = process.env.GLOO_API_KEY || "YOUR_API_KEY";
const API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions";

/**
 * Example 1: Auto-routing - Let Gloo AI select the optimal model
 */
async function makeV2AutoRouting(message: string, tradition: string = "evangelical"): Promise<V2CompletionResponse> {
    const payload = {
        messages: [{ role: "user", content: message }],
        auto_routing: true,
        tradition: tradition
    };

    try {
        const response = await axios.post<V2CompletionResponse>(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error("Error making auto-routing request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Example 2: Model family selection - Choose a provider family
 */
async function makeV2ModelFamily(message: string, modelFamily: string = "anthropic"): Promise<V2CompletionResponse> {
    const payload = {
        messages: [{ role: "user", content: message }],
        model_family: modelFamily
    };

    try {
        const response = await axios.post<V2CompletionResponse>(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error("Error making model family request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Example 3: Direct model selection - Specify an exact model
 */
async function makeV2DirectModel(message: string, model: string = "gloo-anthropic-claude-sonnet-4.5"): Promise<V2CompletionResponse> {
    const payload = {
        messages: [{ role: "user", content: message }],
        model: model,
        temperature: 0.7,
        max_tokens: 500
    };

    try {
        const response = await axios.post<V2CompletionResponse>(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error("Error making direct model request:", error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Test the Completions V2 API with all three routing strategies
 */
async function testCompletionsV2API(): Promise<boolean> {
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

    } catch (error: any) {
        console.error("✗ Test failed:", error.message);
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

    await testCompletionsV2API();
}

// Run the main function
main();
