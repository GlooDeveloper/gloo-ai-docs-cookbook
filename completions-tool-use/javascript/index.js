// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

// --- State Management ---
let tokenInfo = {};

async function getAccessToken() {
    const body = 'grant_type=client_credentials&scope=api/access';
    const response = await axios.post(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: CLIENT_ID, password: CLIENT_SECRET }
    });
    const tokenData = response.data;
    tokenData.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    return tokenData;
}

function isTokenExpired(token) {
    if (!token || !token.expires_at) return true;
    return (Date.now() / 1000) > (token.expires_at - 60);
}

async function createGoalSettingRequest(userGoal) {
    if (isTokenExpired(tokenInfo)) {
        console.log("Token is expired or missing. Fetching a new one...");
        tokenInfo = await getAccessToken();
    }

    const payload = {
        auto_routing: true,
        messages: [{ role: "user", content: userGoal }],
        tools: [
            {
                type: "function",
                function: {
                    name: "create_growth_plan",
                    description: "Creates a structured personal growth plan with a title and a series of actionable steps.",
                    parameters: {
                        type: "object",
                        properties: {
                            goal_title: {
                                type: "string",
                                description: "A concise, encouraging title for the user's goal."
                            },
                            steps: {
                                type: "array",
                                description: "A list of concrete steps the user should take.",
                                items: {
                                    type: "object",
                                    properties: {
                                        step_number: { type: "integer" },
                                        action: {
                                            type: "string",
                                            description: "The specific, actionable task for this step."
                                        },
                                        timeline: {
                                            type: "string",
                                            description: "A suggested timeframe for this step (e.g., 'Week 1-2')."
                                        }
                                    },
                                    required: ["step_number", "action", "timeline"]
                                }
                            }
                        },
                        required: ["goal_title", "steps"]
                    }
                }
            }
        ],
        tool_choice: "required"
    };

    const response = await axios.post(API_URL, payload, {
        headers: {
            'Authorization': `Bearer ${tokenInfo.access_token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
}

function parseGrowthPlan(apiResponse) {
    try {
        const toolCall = apiResponse.choices[0].message.tool_calls[0];
        return JSON.parse(toolCall.function.arguments);
    } catch (error) {
        throw new Error(`Failed to parse growth plan: ${error.message}`);
    }
}

function displayGrowthPlan(growthPlan) {
    console.log(`\n🎯 ${growthPlan.goal_title}`);
    console.log("=".repeat(growthPlan.goal_title.length + 4));
    
    growthPlan.steps.forEach(step => {
        console.log(`\n${step.step_number}. ${step.action}`);
        console.log(`   ⏰ Timeline: ${step.timeline}`);
    });
}

// --- Main Execution ---
async function main() {
    try {
        const userGoal = "I want to grow in my faith.";
        console.log(`Creating growth plan for: '${userGoal}'`);
        
        // Make API call with tool use
        const response = await createGoalSettingRequest(userGoal);
        
        // Parse the structured response
        const growthPlan = parseGrowthPlan(response);
        
        // Display the results
        displayGrowthPlan(growthPlan);
        
        // Also show raw JSON for developers
        console.log(`\n📊 Raw JSON output:`);
        console.log(JSON.stringify(growthPlan, null, 2));
        
    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
    }
}

main();