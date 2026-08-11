import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
API_KEY = os.getenv("GLOO_API_KEY", "")
API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

# Validate that API key is provided
if not API_KEY:
    print("Error: GLOO_API_KEY must be set")
    print("Either:")
    print("1. Create a .env file with your API key:")
    print("   GLOO_API_KEY=your_api_key_here")
    print("2. Export it as an environment variable:")
    print('   export GLOO_API_KEY="your_api_key_here"')
    exit(1)

def create_goal_setting_request(user_goal):
    """Creates a goal-setting request with tool use."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "auto_routing": True,
        "messages": [{"role": "user", "content": user_goal}],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "create_growth_plan",
                    "description": "Creates a structured personal growth plan with a title and a series of actionable steps.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "goal_title": {
                                "type": "string",
                                "description": "A concise, encouraging title for the user's goal."
                            },
                            "steps": {
                                "type": "array",
                                "description": "A list of concrete steps the user should take.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "step_number": {"type": "integer"},
                                        "action": {
                                            "type": "string",
                                            "description": "The specific, actionable task for this step."
                                        },
                                        "timeline": {
                                            "type": "string",
                                            "description": "A suggested timeframe for this step (e.g., 'Week 1-2')."
                                        }
                                    },
                                    "required": ["step_number", "action", "timeline"]
                                }
                            }
                        },
                        "required": ["goal_title", "steps"]
                    }
                }
            }
        ],
        "tool_choice": "required"
    }

    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()

def parse_growth_plan(api_response):
    """Parses the API response and extracts the structured growth plan."""
    try:
        tool_call = api_response['choices'][0]['message']['tool_calls'][0]
        function_args = json.loads(tool_call['function']['arguments'])
        return function_args
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise ValueError(f"Failed to parse growth plan: {e}")

def display_growth_plan(growth_plan):
    """Displays the growth plan in a user-friendly format."""
    print(f"\n🎯 {growth_plan['goal_title']}")
    print("=" * (len(growth_plan['goal_title']) + 4))

    for step in growth_plan['steps']:
        print(f"\n{step['step_number']}. {step['action']}")
        print(f"   ⏰ Timeline: {step['timeline']}")

# --- Main Execution ---
if __name__ == "__main__":
    try:
        user_goal = "I want to grow in my faith."
        print(f"Creating growth plan for: '{user_goal}'")

        # Make API call with tool use
        response = create_goal_setting_request(user_goal)

        # Parse the structured response
        growth_plan = parse_growth_plan(response)

        # Display the results
        display_growth_plan(growth_plan)

        # Also show raw JSON for developers
        print(f"\n📊 Raw JSON output:")
        print(json.dumps(growth_plan, indent=2))

    except requests.exceptions.HTTPError as err:
        print(f"An HTTP error occurred: {err}")
    except Exception as err:
        print(f"An error occurred: {err}")
