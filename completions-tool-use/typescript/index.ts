import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Type definitions
interface GrowthStep {
    step_number: number;
    action: string;
    timeline: string;
}

interface GrowthPlan {
    goal_title: string;
    steps: GrowthStep[];
}

interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

interface ApiResponse {
    choices: Array<{
        message: {
            tool_calls: ToolCall[];
        };
    }>;
}

// --- Configuration ---
const API_KEY = process.env.GLOO_API_KEY || "";
const API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions";

// Validate that API key is provided
if (!API_KEY) {
    console.error("Error: GLOO_API_KEY must be set");
    console.error("Either:");
    console.error("1. Create a .env file with your API key:");
    console.error("   GLOO_API_KEY=your_api_key_here");
    console.error("2. Export it as an environment variable:");
    console.error('   export GLOO_API_KEY="your_api_key_here"');
    process.exit(1);
}

async function createGoalSettingRequest(userGoal: string): Promise<ApiResponse> {
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

    const response = await axios.post<ApiResponse>(API_URL, payload, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
}

function parseGrowthPlan(apiResponse: ApiResponse): GrowthPlan {
    try {
        const toolCall = apiResponse.choices[0].message.tool_calls[0];
        return JSON.parse(toolCall.function.arguments) as GrowthPlan;
    } catch (error: any) {
        throw new Error(`Failed to parse growth plan: ${error.message}`);
    }
}

function displayGrowthPlan(growthPlan: GrowthPlan): void {
    console.log(`\n🎯 ${growthPlan.goal_title}`);
    console.log("=".repeat(growthPlan.goal_title.length + 4));

    growthPlan.steps.forEach(step => {
        console.log(`\n${step.step_number}. ${step.action}`);
        console.log(`   ⏰ Timeline: ${step.timeline}`);
    });
}

// --- Main Execution ---
async function main(): Promise<void> {
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

    } catch (error: any) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
    }
}

main();
