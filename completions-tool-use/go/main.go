package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// --- Configuration ---
var (
	clientID     string
	clientSecret string
	tokenURL     = "https://platform.ai.gloo.com/oauth2/token"
	apiURL       = "https://platform.ai.gloo.com/ai/v1/chat/completions"
)

// --- State Management ---
var tokenInfo *TokenInfo

// --- Data Structures ---
type TokenInfo struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	TokenType   string `json:"token_type"`
}

type GrowthStep struct {
	StepNumber int    `json:"step_number"`
	Action     string `json:"action"`
	Timeline   string `json:"timeline"`
}

type GrowthPlan struct {
	GoalTitle string       `json:"goal_title"`
	Steps     []GrowthStep `json:"steps"`
}

type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type ApiResponse struct {
	Choices []struct {
		Message struct {
			ToolCalls []ToolCall `json:"tool_calls"`
		} `json:"message"`
	} `json:"choices"`
}

// --- Function Definitions ---
func getAccessToken() (*TokenInfo, error) {
	data := strings.NewReader("grant_type=client_credentials&scope=api/access")
	req, err := http.NewRequest("POST", tokenURL, data)
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get token: %s - %s", resp.Status, string(bodyBytes))
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var localTokenInfo TokenInfo
	if err := json.Unmarshal(body, &localTokenInfo); err != nil {
		return nil, err
	}

	localTokenInfo.ExpiresAt = time.Now().Unix() + int64(localTokenInfo.ExpiresIn)
	return &localTokenInfo, nil
}

func isTokenExpired(token *TokenInfo) bool {
	if token == nil || token.ExpiresAt == 0 {
		return true
	}
	return time.Now().Unix() > (token.ExpiresAt - 60)
}

func createGoalSettingRequest(userGoal string) (*ApiResponse, error) {
	var err error
	if isTokenExpired(tokenInfo) {
		fmt.Println("Token is expired or missing. Fetching a new one...")
		tokenInfo, err = getAccessToken()
		if err != nil {
			return nil, err
		}
	}

	tools := []map[string]interface{}{
		{
			"type": "function",
			"function": map[string]interface{}{
				"name":        "create_growth_plan",
				"description": "Creates a structured personal growth plan with a title and a series of actionable steps.",
				"parameters": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"goal_title": map[string]interface{}{
							"type":        "string",
							"description": "A concise, encouraging title for the user's goal.",
						},
						"steps": map[string]interface{}{
							"type":        "array",
							"description": "A list of concrete steps the user should take.",
							"items": map[string]interface{}{
								"type": "object",
								"properties": map[string]interface{}{
									"step_number": map[string]string{"type": "integer"},
									"action": map[string]string{
										"type":        "string",
										"description": "The specific, actionable task for this step.",
									},
									"timeline": map[string]string{
										"type":        "string",
										"description": "A suggested timeframe for this step (e.g., 'Week 1-2').",
									},
								},
								"required": []string{"step_number", "action", "timeline"},
							},
						},
					},
					"required": []string{"goal_title", "steps"},
				},
			},
		},
	}

	payload := map[string]interface{}{
		"model":       "us.anthropic.claude-sonnet-4-20250514-v1:0",
		"messages":    []map[string]string{{"role": "user", "content": userGoal}},
		"tools":       tools,
		"tool_choice": "required",
	}
	jsonPayload, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+tokenInfo.AccessToken)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API call failed: %s - %s", resp.Status, string(body))
	}

	var result ApiResponse
	json.Unmarshal(body, &result)

	return &result, nil
}

func parseGrowthPlan(apiResponse *ApiResponse) (*GrowthPlan, error) {
	if len(apiResponse.Choices) == 0 || len(apiResponse.Choices[0].Message.ToolCalls) == 0 {
		return nil, fmt.Errorf("no tool calls found in response")
	}

	toolCall := apiResponse.Choices[0].Message.ToolCalls[0]
	var growthPlan GrowthPlan
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &growthPlan); err != nil {
		return nil, fmt.Errorf("failed to parse growth plan: %v", err)
	}

	return &growthPlan, nil
}

func displayGrowthPlan(growthPlan *GrowthPlan) {
	fmt.Printf("\n🎯 %s\n", growthPlan.GoalTitle)
	fmt.Printf("%s\n", strings.Repeat("=", len(growthPlan.GoalTitle)+4))

	for _, step := range growthPlan.Steps {
		fmt.Printf("\n%d. %s\n", step.StepNumber, step.Action)
		fmt.Printf("   ⏰ Timeline: %s\n", step.Timeline)
	}
}

// Helper to get environment variables
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// Initialize loads environment variables and validates configuration
func init() {
	// Load environment variables from .env file if it exists
	_ = godotenv.Load()

	// Get credentials from environment
	clientID = getEnv("GLOO_CLIENT_ID", "")
	clientSecret = getEnv("GLOO_CLIENT_SECRET", "")

	// Validate that credentials are provided
	if clientID == "" || clientSecret == "" {
		fmt.Println("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
		fmt.Println("Either:")
		fmt.Println("1. Create a .env file with your credentials:")
		fmt.Println("   GLOO_CLIENT_ID=your_client_id_here")
		fmt.Println("   GLOO_CLIENT_SECRET=your_client_secret_here")
		fmt.Println("2. Export them as environment variables:")
		fmt.Println("   export GLOO_CLIENT_ID=\"your_client_id_here\"")
		fmt.Println("   export GLOO_CLIENT_SECRET=\"your_client_secret_here\"")
		os.Exit(1)
	}
}

// --- Main Execution ---
func main() {
	userGoal := "I want to grow in my faith."
	fmt.Printf("Creating growth plan for: '%s'\n", userGoal)

	// Make API call with tool use
	response, err := createGoalSettingRequest(userGoal)
	if err != nil {
		fmt.Printf("Error creating growth plan: %v\n", err)
		return
	}

	// Parse the structured response
	growthPlan, err := parseGrowthPlan(response)
	if err != nil {
		fmt.Printf("Error parsing growth plan: %v\n", err)
		return
	}

	// Display the results
	displayGrowthPlan(growthPlan)

	// Also show raw JSON for developers
	fmt.Printf("\n📊 Raw JSON output:\n")
	jsonBytes, _ := json.MarshalIndent(growthPlan, "", "  ")
	fmt.Printf("%s\n", string(jsonBytes))
}