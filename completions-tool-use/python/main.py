import requests
import time
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
# It's recommended to load credentials from environment variables
CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
API_URL = "https://platform.ai.gloo.com/ai/v1/chat/completions"

# --- State Management ---
# In a real application, you would persist this token information
access_token_info = {}

def get_access_token():
    """Retrieves a new access token."""
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"grant_type": "client_credentials", "scope": "api/access"}
    response = requests.post(TOKEN_URL, headers=headers, data=data, auth=(CLIENT_ID, CLIENT_SECRET))
    response.raise_for_status()
    token_data = response.json()
    token_data['expires_at'] = int(time.time()) + token_data['expires_in']
    return token_data

def is_token_expired(token_info):
    """Checks if the token is expired or close to expiring."""
    if not token_info or 'expires_at' not in token_info:
        return True
    return time.time() > (token_info['expires_at'] - 60)

def create_goal_setting_request(user_goal):
    """Creates a goal-setting request with tool use."""
    global access_token_info
    if is_token_expired(access_token_info):
        print("Token is expired or missing. Fetching a new one...")
        access_token_info = get_access_token()

    headers = {
        "Authorization": f"Bearer {access_token_info['access_token']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
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