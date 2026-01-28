package com.gloo.completionstooluse;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import io.github.cdimascio.dotenv.Dotenv;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

// --- Main Application Class ---
public class Main {
    public static void main(String[] args) {
        // Validate credentials before proceeding
        if (!CompletionsToolUse.validateCredentials()) {
            System.exit(1);
        }
        
        CompletionsToolUse toolUse = new CompletionsToolUse();
        try {
            String userGoal = "I want to grow in my faith.";
            System.out.println("Creating growth plan for: '" + userGoal + "'");
            
            // Make API call with tool use
            CompletionsToolUse.ApiResponse response = toolUse.createGoalSettingRequest(userGoal);
            
            // Parse the structured response
            CompletionsToolUse.GrowthPlan growthPlan = toolUse.parseGrowthPlan(response);
            
            // Display the results
            toolUse.displayGrowthPlan(growthPlan);
            
            // Also show raw JSON for developers
            System.out.println("\n📊 Raw JSON output:");
            System.out.println(toolUse.gson.toJson(growthPlan));
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

// --- Completions Tool Use Class ---
class CompletionsToolUse {
    // Load environment variables from .env file if it exists
    private static final Dotenv dotenv = Dotenv.configure()
            .ignoreIfMissing()
            .load();
    
    private static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    private static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

    private TokenInfo tokenInfo;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    public final Gson gson = new Gson();
    
    // Validate that credentials are provided
    public static boolean validateCredentials() {
        if ("YOUR_CLIENT_ID".equals(CLIENT_ID) || CLIENT_ID == null || CLIENT_ID.trim().isEmpty() ||
            "YOUR_CLIENT_SECRET".equals(CLIENT_SECRET) || CLIENT_SECRET == null || CLIENT_SECRET.trim().isEmpty()) {
            System.err.println("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set");
            System.err.println("Either:");
            System.err.println("1. Create a .env file with your credentials:");
            System.err.println("   GLOO_CLIENT_ID=your_client_id_here");
            System.err.println("   GLOO_CLIENT_SECRET=your_client_secret_here");
            System.err.println("2. Export them as environment variables:");
            System.err.println("   export GLOO_CLIENT_ID=\"your_client_id_here\"");
            System.err.println("   export GLOO_CLIENT_SECRET=\"your_client_secret_here\"");
            return false;
        }
        return true;
    }

    // --- Data Classes ---
    public static class TokenInfo {
        String access_token;
        int expires_in;
        long expires_at;
    }

    public static class GrowthStep {
        int step_number;
        String action;
        String timeline;
    }

    public static class GrowthPlan {
        String goal_title;
        List<GrowthStep> steps;
    }

    public static class ToolCall {
        String id;
        String type;
        Function function;
        
        public static class Function {
            String name;
            String arguments;
        }
    }

    public static class ApiResponse {
        List<Choice> choices;
        
        public static class Choice {
            Message message;
            
            public static class Message {
                List<ToolCall> tool_calls;
            }
        }
    }

    // --- Token Management ---
    private void fetchAccessToken() throws IOException, InterruptedException {
        String auth = CLIENT_ID + ":" + CLIENT_SECRET;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        String requestBody = "grant_type=client_credentials&scope=api/access";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Failed to get token: " + response.body());
        }

        this.tokenInfo = gson.fromJson(response.body(), TokenInfo.class);
        this.tokenInfo.expires_at = Instant.now().getEpochSecond() + this.tokenInfo.expires_in;
    }

    private boolean isTokenExpired() {
        if (this.tokenInfo == null || this.tokenInfo.expires_at == 0) return true;
        return Instant.now().getEpochSecond() > (this.tokenInfo.expires_at - 60);
    }

    // --- API Methods ---
    public CompletionsToolUse.ApiResponse createGoalSettingRequest(String userGoal) throws IOException, InterruptedException {
        if (isTokenExpired()) {
            System.out.println("Token is expired or missing. Fetching a new one...");
            fetchAccessToken();
        }

        // Create the tool definition using JsonObject for proper structure
        JsonObject toolSchema = new JsonObject();
        toolSchema.addProperty("type", "function");
        
        JsonObject function = new JsonObject();
        function.addProperty("name", "create_growth_plan");
        function.addProperty("description", "Creates a structured personal growth plan with a title and a series of actionable steps.");
        
        JsonObject parameters = new JsonObject();
        parameters.addProperty("type", "object");
        
        JsonObject properties = new JsonObject();
        
        JsonObject goalTitle = new JsonObject();
        goalTitle.addProperty("type", "string");
        goalTitle.addProperty("description", "A concise, encouraging title for the user's goal.");
        properties.add("goal_title", goalTitle);
        
        JsonObject steps = new JsonObject();
        steps.addProperty("type", "array");
        steps.addProperty("description", "A list of concrete steps the user should take.");
        
        JsonObject items = new JsonObject();
        items.addProperty("type", "object");
        
        JsonObject itemProperties = new JsonObject();
        JsonObject stepNumber = new JsonObject();
        stepNumber.addProperty("type", "integer");
        itemProperties.add("step_number", stepNumber);
        
        JsonObject action = new JsonObject();
        action.addProperty("type", "string");
        action.addProperty("description", "The specific, actionable task for this step.");
        itemProperties.add("action", action);
        
        JsonObject timeline = new JsonObject();
        timeline.addProperty("type", "string");
        timeline.addProperty("description", "A suggested timeframe for this step (e.g., 'Week 1-2').");
        itemProperties.add("timeline", timeline);
        
        items.add("properties", itemProperties);
        
        JsonArray required = new JsonArray();
        required.add("step_number");
        required.add("action");
        required.add("timeline");
        items.add("required", required);
        
        steps.add("items", items);
        properties.add("steps", steps);
        
        parameters.add("properties", properties);
        
        JsonArray requiredParams = new JsonArray();
        requiredParams.add("goal_title");
        requiredParams.add("steps");
        parameters.add("required", requiredParams);
        
        function.add("parameters", parameters);
        toolSchema.add("function", function);

        JsonArray tools = new JsonArray();
        tools.add(toolSchema);

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", userGoal);

        JsonArray messages = new JsonArray();
        messages.add(message);

        JsonObject payload = new JsonObject();
        payload.addProperty("auto_routing", true);
        payload.add("messages", messages);
        payload.add("tools", tools);
        payload.addProperty("tool_choice", "required");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + this.tokenInfo.access_token)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(payload)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("API call failed: " + response.body());
        }

        return gson.fromJson(response.body(), CompletionsToolUse.ApiResponse.class);
    }

    public CompletionsToolUse.GrowthPlan parseGrowthPlan(CompletionsToolUse.ApiResponse apiResponse) {
        try {
            ToolCall toolCall = apiResponse.choices.get(0).message.tool_calls.get(0);
            return gson.fromJson(toolCall.function.arguments, CompletionsToolUse.GrowthPlan.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse growth plan: " + e.getMessage(), e);
        }
    }

    public void displayGrowthPlan(CompletionsToolUse.GrowthPlan growthPlan) {
        System.out.println("\n🎯 " + growthPlan.goal_title);
        System.out.println("=".repeat(growthPlan.goal_title.length() + 4));
        
        for (CompletionsToolUse.GrowthStep step : growthPlan.steps) {
            System.out.println("\n" + step.step_number + ". " + step.action);
            System.out.println("   ⏰ Timeline: " + step.timeline);
        }
    }
}