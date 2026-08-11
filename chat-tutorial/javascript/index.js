#!/usr/bin/env node
/**
 * Gloo AI Chat Message Tutorial - JavaScript Example
 *
 * This example demonstrates how to:
 * 1. Authenticate with the Gloo AI API using an API key
 * 2. Create a new chat session with suggestions enabled
 * 3. Continue a conversation using suggested responses
 * 4. Retrieve and display chat history (optional)
 *
 * Key Learning Points:
 * - Step 2: Create chat with suggestions enabled
 * - Step 3: Continue conversation using chat_id (no history retrieval needed)
 * - Step 4: Optionally retrieve chat history for display
 *
 * Prerequisites:
 * - Node.js 18+
 * - npm install axios dotenv
 * - Create a .env file with your API key:
 *   GLOO_API_KEY=your_api_key
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_KEY = process.env.GLOO_API_KEY || "";
const MESSAGE_API_URL = "https://platform.ai.gloo.com/ai/v1/message";
const CHAT_API_URL = "https://platform.ai.gloo.com/ai/v1/chat";

/**
 * Send a message to the chat API
 */
async function sendMessage(messageText, chatId = null) {
    try {
        const payload = {
            query: messageText,
            character_limit: 1000,
            sources_limit: 5,
            stream: false,
            publishers: [],
            enable_suggestions: 1  // Enable suggested follow-up questions
        };

        if (chatId) {
            payload.chat_id = chatId;
        }

        const response = await axios.post(MESSAGE_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get chat history for a specific chat ID
 */
async function getChatHistory(chatId) {
    try {
        const response = await axios.get(CHAT_API_URL, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {
                chat_id: chatId
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error getting chat history:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Main function demonstrating the complete chat flow
 */
async function main() {
    try {
        // Check if API key is provided
        if (!API_KEY) {
            console.log("Please set your GLOO_API_KEY environment variable");
            console.log("Create a .env file with:");
            console.log("GLOO_API_KEY=your_api_key");
            return;
        }

        // Start with a deep, meaningful question about human flourishing
        const initialQuestion = "How can I find meaning and purpose when facing life's greatest challenges?";

        console.log("=== Starting New Chat Session ===");
        console.log(`Question: ${initialQuestion}`);
        console.log();

        // Create new chat session
        const chatResponse = await sendMessage(initialQuestion);
        const chatId = chatResponse.chat_id;

        console.log("AI Response:");
        console.log(chatResponse.message);
        console.log();

        // Show suggested follow-up questions
        if (chatResponse.suggestions && chatResponse.suggestions.length > 0) {
            console.log("Suggested follow-up questions:");
            chatResponse.suggestions.forEach((suggestion, index) => {
                console.log(`${index + 1}. ${suggestion}`);
            });
            console.log();
        }

        // Use the first suggested question for follow-up, or fallback
        const followUpQuestion = chatResponse.suggestions && chatResponse.suggestions.length > 0
            ? chatResponse.suggestions[0]
            : "Can you give me practical steps I can take today to begin this journey?";

        console.log("=== Continuing the Conversation ===");
        console.log(`Using suggested question: ${followUpQuestion}`);
        console.log();

        // Send follow-up message
        const followUpResponse = await sendMessage(followUpQuestion, chatId);

        console.log("AI Response:");
        console.log(followUpResponse.message);
        console.log();

        // Display final chat history (optional)
        console.log("=== Complete Chat History (Optional) ===");
        console.log("This shows how to retrieve the complete conversation history:");
        console.log();

        const chatHistory = await getChatHistory(chatId);

        chatHistory.messages.forEach((message, index) => {
            const role = message.role.toUpperCase();
            const content = message.message;
            console.log(`${index + 1}. ${role}: ${content}`);
            console.log();
        });

        console.log("Chat session completed successfully!");
        console.log(`Total messages: ${chatHistory.messages.length}`);
        console.log(`Chat ID: ${chatId}`);
        console.log();
        console.log("Key Learning Points:");
        console.log("- Step 1: Authentication with API key");
        console.log("- Step 2: Create chat with suggestions enabled");
        console.log("- Step 3: Continue conversation using chat_id (no history retrieval needed)");
        console.log("- Step 4: Optionally retrieve chat history for display");

    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    sendMessage,
    getChatHistory
};
