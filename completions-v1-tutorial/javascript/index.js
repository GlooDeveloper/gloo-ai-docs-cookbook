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
const API_KEY = process.env.GLOO_API_KEY || "YOUR_API_KEY";
const API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions";

/**
 * Make a chat completion request
 */
async function makeChatCompletionRequest(message = "How can I be joyful in hard times?") {
    const payload = {
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        messages: [{ role: "user", content: message }]
    };

    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
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
    if (API_KEY === "YOUR_API_KEY") {
        console.log("Please set your GLOO_API_KEY environment variable");
        console.log("You can create a .env file with:");
        console.log("GLOO_API_KEY=your_api_key");
        return;
    }

    await testCompletionsAPI();
}

// Export functions for use in other modules
module.exports = {
    makeChatCompletionRequest,
    testCompletionsAPI
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
