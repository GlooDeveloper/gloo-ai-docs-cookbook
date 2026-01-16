#!/usr/bin/env tsx
/**
 * Gloo AI Chat Message Tutorial - TypeScript Example
 * 
 * This example demonstrates how to:
 * 1. Authenticate with the Gloo AI API using proper TypeScript types
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
 * - Create a .env file with your credentials:
 *   GLOO_CLIENT_ID=your_client_id
 *   GLOO_CLIENT_SECRET=your_client_secret
 */

import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const MESSAGE_API_URL = "https://platform.ai.gloo.com/ai/v1/message";
const CHAT_API_URL = "https://platform.ai.gloo.com/ai/v1/chat";

// Type definitions
interface TokenInfo {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
}

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

// Global token storage
let tokenInfo: TokenInfo | null = null;

/**
 * Get a new access token from the Gloo AI API
 */
async function getAccessToken(): Promise<TokenInfo> {
    try {
        const body = 'grant_type=client_credentials&scope=api/access';
        const response: AxiosResponse<TokenInfo> = await axios.post(TOKEN_URL, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: { username: CLIENT_ID, password: CLIENT_SECRET }
        });
        
        const tokenData = response.data;
        // Add expires_at timestamp for easier expiration checking
        (tokenData as any).expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
        
        return tokenData;
    } catch (error: any) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw new Error(`Authentication failed: ${error.response?.data?.detail || error.message}`);
    }
}

/**
 * Check if the current token is expired
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
 * Send a message to the chat API
 */
async function sendMessage(messageText: string, chatId?: string): Promise<MessageResponse> {
    try {
        const token = await ensureValidToken();
        
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
                'Authorization': `Bearer ${token}`,
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
        const token = await ensureValidToken();
        
        const response: AxiosResponse<ChatHistory> = await axios.get(CHAT_API_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
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
    if (CLIENT_ID === "YOUR_CLIENT_ID" || CLIENT_SECRET === "YOUR_CLIENT_SECRET") {
        console.log("❌ Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
        console.log("Create a .env file with:");
        console.log("GLOO_CLIENT_ID=your_client_id");
        console.log("GLOO_CLIENT_SECRET=your_client_secret");
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
        
        console.log("✅ Chat session completed successfully!");
        console.log(`📊 Total messages: ${chatHistory.messages.length}`);
        console.log(`🔗 Chat ID: ${chatId}`);
        console.log(`📅 Session created: ${new Date(chatHistory.created_at).toLocaleString()}`);
        console.log();
        console.log("💡 Key Learning Points:");
        console.log("• Step 1: Authentication with OAuth2");
        console.log("• Step 2: Create chat with suggestions enabled");
        console.log("• Step 3: Continue conversation using chat_id (no history retrieval needed)");
        console.log("• Step 4: Optionally retrieve chat history for display");
        
    } catch (error: any) {
        console.error("❌ Error:", error.message);
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
    ensureValidToken,
    TokenInfo,
    MessageResponse,
    MessageRequest,
    ChatMessage,
    ChatHistory
};