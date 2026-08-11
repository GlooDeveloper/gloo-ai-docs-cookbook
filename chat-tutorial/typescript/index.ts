#!/usr/bin/env tsx
/**
 * Gloo AI Chat Message Tutorial - TypeScript Example
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
 * - npm install axios dotenv @types/node ts-node typescript
 * - Create a .env file with your API key:
 *   GLOO_API_KEY=your_api_key
 */

import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const API_KEY = process.env.GLOO_API_KEY || "";
const MESSAGE_API_URL = "https://platform.ai.gloo.com/ai/v1/message";
const CHAT_API_URL = "https://platform.ai.gloo.com/ai/v1/chat";

// Type definitions
interface MessageResponse {
    chat_id: string;
    query_id: string;
    message_id: string;
    message: string;
    timestamp: string;
    success: boolean;
    suggestions?: string[];
    sources?: any[];
}

interface MessageRequest {
    query: string;
    character_limit?: number;
    sources_limit?: number;
    stream?: boolean;
    publishers?: string[];
    chat_id?: string;
    enable_suggestions?: number;
}

interface ChatMessage {
    query_id: string;
    message_id: string;
    timestamp: string;
    role: 'user' | 'kallm';
    message: string;
    character_limit?: number;
}

interface ChatHistory {
    chat_id: string;
    created_at: string;
    messages: ChatMessage[];
}

/**
 * Send a message to the chat API
 */
async function sendMessage(messageText: string, chatId?: string): Promise<MessageResponse> {
    try {
        const payload: MessageRequest = {
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

        const response: AxiosResponse<MessageResponse> = await axios.post(MESSAGE_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Error sending message:', error.response?.data || error.message);
        throw new Error(`Message sending failed: ${error.response?.data?.detail || error.message}`);
    }
}

/**
 * Get chat history for a specific chat ID
 */
async function getChatHistory(chatId: string): Promise<ChatHistory> {
    try {
        const response: AxiosResponse<ChatHistory> = await axios.get(CHAT_API_URL, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {
                chat_id: chatId
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Error getting chat history:', error.response?.data || error.message);
        throw new Error(`Chat history retrieval failed: ${error.response?.data?.detail || error.message}`);
    }
}

/**
 * Validate environment variables
 */
function validateEnvironment(): void {
    if (!API_KEY) {
        console.log("Please set your GLOO_API_KEY environment variable");
        console.log("Create a .env file with:");
        console.log("GLOO_API_KEY=your_api_key");
        process.exit(1);
    }
}

/**
 * Display chat message with formatting
 */
function displayMessage(message: ChatMessage, index: number): void {
    const role = message.role.toUpperCase();
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    console.log(`${index + 1}. ${role} [${timestamp}]:`);
    console.log(message.message);
    console.log();
}

/**
 * Main function demonstrating the complete chat flow
 */
async function main(): Promise<void> {
    try {
        // Validate environment
        validateEnvironment();

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
            displayMessage(message, index);
        });

        console.log("Chat session completed successfully!");
        console.log(`Total messages: ${chatHistory.messages.length}`);
        console.log(`Chat ID: ${chatId}`);
        console.log(`Session created: ${new Date(chatHistory.created_at).toLocaleString()}`);
        console.log();
        console.log("Key Learning Points:");
        console.log("- Step 1: Authentication with API key");
        console.log("- Step 2: Create chat with suggestions enabled");
        console.log("- Step 3: Continue conversation using chat_id (no history retrieval needed)");
        console.log("- Step 4: Optionally retrieve chat history for display");

    } catch (error: any) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}

// Export functions for use in other modules
export {
    sendMessage,
    getChatHistory,
    MessageResponse,
    MessageRequest,
    ChatMessage,
    ChatHistory
};
