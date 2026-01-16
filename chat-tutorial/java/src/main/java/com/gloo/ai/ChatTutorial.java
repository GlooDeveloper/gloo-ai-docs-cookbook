package com.gloo.ai;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Properties;

/**
 * Gloo AI Chat Message Tutorial - Java Example
 * 
 * This example demonstrates how to:
 * 1. Authenticate with the Gloo AI API using OAuth2
 * 2. Create a new chat session with suggestions enabled
 * 3. Continue a conversation using suggested responses
 * 4. Retrieve and display chat history (optional)
 * 5. Handle errors gracefully with modern Java practices
 * 
 * Key Learning Points:
 * - Step 2: Create chat with suggestions enabled
 * - Step 3: Continue conversation using chat_id (no history retrieval needed)
 * - Step 4: Optionally retrieve chat history for display
 * 
 * Prerequisites:
 * - Java 17+
 * - Maven dependencies: gson
 * - Create a .env file with your credentials:
 *   GLOO_CLIENT_ID=your_client_id
 *   GLOO_CLIENT_SECRET=your_client_secret
 * 
 * Usage:
 *     mvn exec:java
 *     or
 *     java -jar target/chat-message-tutorial-1.0.0.jar
 */
public class ChatTutorial {
    
    // Configuration constants
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String MESSAGE_API_URL = "https://platform.ai.gloo.com/ai/v1/message";
    private static final String CHAT_API_URL = "https://platform.ai.gloo.com/ai/v1/chat";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(30);
    
    // Data classes
    public static class TokenInfo {
        @SerializedName("access_token")
        public String accessToken;
        
        @SerializedName("expires_in")
        public int expiresIn;
        
        @SerializedName("expires_at")
        public long expiresAt;
        
        @SerializedName("token_type")
        public String tokenType;
    }
    
    public static class MessageRequest {
        public String query;
        
        @SerializedName("character_limit")
        public Integer characterLimit;
        
        @SerializedName("sources_limit")
        public Integer sourcesLimit;
        
        public Boolean stream;
        public List<String> publishers;
        
        @SerializedName("chat_id")
        public String chatId;
        
        @SerializedName("enable_suggestions")
        public Integer enableSuggestions;
    }
    
    public static class MessageResponse {
        @SerializedName("chat_id")
        public String chatId;
        
        @SerializedName("query_id")
        public String queryId;
        
        @SerializedName("message_id")
        public String messageId;
        
        public String message;
        public String timestamp;
        public Boolean success;
        public List<String> suggestions;
        public List<Object> sources;
    }
    
    public static class ChatMessage {
        @SerializedName("query_id")
        public String queryId;
        
        @SerializedName("message_id")
        public String messageId;
        
        public String timestamp;
        public String role;
        public String message;
        
        @SerializedName("character_limit")
        public Integer characterLimit;
    }
    
    public static class ChatHistory {
        @SerializedName("chat_id")
        public String chatId;
        
        @SerializedName("created_at")
        public String createdAt;
        
        public List<ChatMessage> messages;
    }
    
    public static class ApiError {
        public String detail;
        public String code;
    }
    
    // Custom exception for API errors
    public static class GlooApiException extends Exception {
        public final int statusCode;
        
        public GlooApiException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }
        
        public GlooApiException(String message, int statusCode, Throwable cause) {
            super(message, cause);
            this.statusCode = statusCode;
        }
    }
    
    // Instance variables
    private final String clientId;
    private final String clientSecret;
    private final HttpClient httpClient;
    private final Gson gson;
    private TokenInfo tokenInfo;
    
    public ChatTutorial() {
        // Load configuration from environment variables or .env file
        this.clientId = getEnvOrDefault("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
        this.clientSecret = getEnvOrDefault("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
        
        // Initialize HTTP client with timeout
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(HTTP_TIMEOUT)
                .build();
        
        // Initialize Gson with pretty printing
        this.gson = new GsonBuilder()
                .setPrettyPrinting()
                .create();
    }
    
    private String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        if (value != null && !value.trim().isEmpty()) {
            return value;
        }
        
        // Try to load from .env file
        try {
            Properties props = new Properties();
            File envFile = new File(".env");
            if (envFile.exists()) {
                props.load(new FileInputStream(envFile));
                value = props.getProperty(key);
                if (value != null && !value.trim().isEmpty()) {
                    return value;
                }
            }
        } catch (IOException e) {
            // .env file is optional, so ignore errors
        }
        
        return defaultValue;
    }
    
    private TokenInfo getAccessToken() throws GlooApiException, IOException, InterruptedException {
        String auth = clientId + ":" + clientSecret;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        String requestBody = "grant_type=client_credentials&scope=api/access";
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .timeout(HTTP_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            ApiError apiError = null;
            try {
                apiError = gson.fromJson(response.body(), ApiError.class);
            } catch (Exception e) {
                // Ignore JSON parsing errors
            }
            
            String errorMessage = "Authentication failed: ";
            if (apiError != null && apiError.detail != null) {
                errorMessage += apiError.detail;
            } else {
                errorMessage += "HTTP " + response.statusCode() + " - " + response.body();
            }
            
            throw new GlooApiException(errorMessage, response.statusCode());
        }
        
        TokenInfo token = gson.fromJson(response.body(), TokenInfo.class);
        token.expiresAt = Instant.now().getEpochSecond() + token.expiresIn;
        
        return token;
    }
    
    private boolean isTokenExpired(TokenInfo token) {
        if (token == null || token.expiresAt == 0) {
            return true;
        }
        return Instant.now().getEpochSecond() > (token.expiresAt - 60);
    }
    
    private String ensureValidToken() throws GlooApiException, IOException, InterruptedException {
        if (isTokenExpired(tokenInfo)) {
            System.out.println("Getting new access token...");
            tokenInfo = getAccessToken();
        }
        return tokenInfo.accessToken;
    }
    
    public MessageResponse sendMessage(String messageText, String chatId) throws GlooApiException, IOException, InterruptedException {
        String token = ensureValidToken();
        
        MessageRequest payload = new MessageRequest();
        payload.query = messageText;
        payload.characterLimit = 1000;
        payload.sourcesLimit = 5;
        payload.stream = false;
        payload.publishers = List.of();
        payload.chatId = chatId;
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(MESSAGE_API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            ApiError apiError = null;
            try {
                apiError = gson.fromJson(response.body(), ApiError.class);
            } catch (Exception e) {
                // Ignore JSON parsing errors
            }
            
            String errorMessage = "Message sending failed: ";
            if (apiError != null && apiError.detail != null) {
                errorMessage += apiError.detail;
            } else {
                errorMessage += "HTTP " + response.statusCode() + " - " + response.body();
            }
            
            throw new GlooApiException(errorMessage, response.statusCode());
        }
        
        return gson.fromJson(response.body(), MessageResponse.class);
    }
    
    public ChatHistory getChatHistory(String chatId) throws GlooApiException, IOException, InterruptedException {
        String token = ensureValidToken();
        
        String url = CHAT_API_URL + "?chat_id=" + chatId;
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .timeout(HTTP_TIMEOUT)
                .GET()
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            ApiError apiError = null;
            try {
                apiError = gson.fromJson(response.body(), ApiError.class);
            } catch (Exception e) {
                // Ignore JSON parsing errors
            }
            
            String errorMessage = "Chat history retrieval failed: ";
            if (apiError != null && apiError.detail != null) {
                errorMessage += apiError.detail;
            } else {
                errorMessage += "HTTP " + response.statusCode() + " - " + response.body();
            }
            
            throw new GlooApiException(errorMessage, response.statusCode());
        }
        
        return gson.fromJson(response.body(), ChatHistory.class);
    }
    
    private String formatTimestamp(String timestamp) {
        try {
            Instant instant = Instant.parse(timestamp);
            LocalDateTime dateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
            return dateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception e) {
            return timestamp;
        }
    }
    
    private void validateEnvironment() throws IllegalStateException {
        if ("YOUR_CLIENT_ID".equals(clientId) || "YOUR_CLIENT_SECRET".equals(clientSecret)) {
            throw new IllegalStateException("Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables");
        }
    }
    
    private void displayMessage(ChatMessage message, int index) {
        String role = message.role.toUpperCase();
        String timestamp = formatTimestamp(message.timestamp);
        System.out.printf("%d. %s [%s]:%n", index + 1, role, timestamp);
        System.out.println(message.message);
        System.out.println();
    }
    
    public void runExample() {
        try {
            // Validate environment
            validateEnvironment();
            
            // Start with a deep, meaningful question about human flourishing
            String initialQuestion = "How can I find meaning and purpose when facing life's greatest challenges?";
            
            System.out.println("=== Starting New Chat Session ===");
            System.out.println("Question: " + initialQuestion);
            System.out.println();
            
            // Create new chat session
            MessageResponse chatResponse = sendMessage(initialQuestion, null);
            String chatId = chatResponse.chatId;
            
            System.out.println("AI Response:");
            System.out.println(chatResponse.message);
            System.out.println();

            // Show suggested follow-up questions
            List<String> suggestions = chatResponse.suggestions;
            if (suggestions != null && !suggestions.isEmpty()) {
                System.out.println("Suggested follow-up questions:");
                for (int i = 0; i < suggestions.size(); i++) {
                    System.out.println((i + 1) + ". " + suggestions.get(i));
                }
                System.out.println();
            }
                
            // Use the first suggested question for follow-up, or fallback
            String followUpQuestion = (suggestions != null && !suggestions.isEmpty()) 
                ? suggestions.get(0) 
                : "Can you give me practical steps I can take today to begin this journey?";
        
            System.out.println("=== Continuing the Conversation ===");
            System.out.println("Using suggested question: " + followUpQuestion);
            System.out.println();
        
            // Send follow-up message
            MessageResponse followUpResponse = sendMessage(followUpQuestion, chatId);
        
            System.out.println("AI Response:");
            System.out.println(followUpResponse.message);
            System.out.println();
            
            // Display final chat history
            System.out.println("=== Complete Chat History ===");
            ChatHistory chatHistory = getChatHistory(chatId);
            
            for (int i = 0; i < chatHistory.messages.size(); i++) {
                displayMessage(chatHistory.messages.get(i), i);
            }
            
            System.out.println("✅ Chat session completed successfully!");
            System.out.println("📊 Total messages: " + chatHistory.messages.size());
            System.out.println("🔗 Chat ID: " + chatId);
            System.out.println("📅 Session created: " + formatTimestamp(chatHistory.createdAt));
            
        } catch (IllegalStateException e) {
            System.err.println("❌ Environment Error: " + e.getMessage());
            System.err.println("Create a .env file with:");
            System.err.println("GLOO_CLIENT_ID=your_client_id");
            System.err.println("GLOO_CLIENT_SECRET=your_client_secret");
            System.exit(1);
        } catch (GlooApiException e) {
            System.err.println("❌ API Error: " + e.getMessage());
            System.err.println("Status Code: " + e.statusCode);
            System.exit(1);
        } catch (InterruptedException e) {
            System.err.println("❌ Operation interrupted: " + e.getMessage());
            Thread.currentThread().interrupt();
            System.exit(1);
        } catch (Exception e) {
            System.err.println("❌ Unexpected error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    public static void main(String[] args) {
        ChatTutorial tutorial = new ChatTutorial();
        tutorial.runExample();
    }
}