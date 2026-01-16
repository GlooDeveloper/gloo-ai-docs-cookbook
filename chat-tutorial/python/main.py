#!/usr/bin/env python3
"""
Gloo AI Chat Message Tutorial - Python Example

This example demonstrates how to:
1. Authenticate with the Gloo AI API using OAuth2
2. Create a new chat session with suggestions enabled
3. Continue a conversation using suggested responses
4. Retrieve and display chat history (optional)
5. Handle errors gracefully

Key Learning Points:
- Step 2: Create chat with suggestions enabled
- Step 3: Continue conversation using chat_id (no history retrieval needed)
- Step 4: Optionally retrieve chat history for display

Prerequisites:
- Python 3.9+
- pip install requests python-dotenv
- Create a .env file with your credentials:
  GLOO_CLIENT_ID=your_client_id
  GLOO_CLIENT_SECRET=your_client_secret

Usage:
    python main.py
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
MESSAGE_API_URL = "https://platform.ai.gloo.com/ai/v1/message"
CHAT_API_URL = "https://platform.ai.gloo.com/ai/v1/chat"

# Data classes for type safety
@dataclass
class TokenInfo:
    access_token: str
    expires_in: int
    expires_at: int
    token_type: str

@dataclass
class MessageResponse:
    chat_id: str
    query_id: str
    message_id: str
    message: str
    timestamp: str
    success: bool
    suggestions: List[str]
    sources: List[Any]

@dataclass
class ChatMessage:
    query_id: str
    message_id: str
    timestamp: str
    role: str
    message: str
    character_limit: Optional[int] = None

@dataclass
class ChatHistory:
    chat_id: str
    created_at: str
    messages: List[ChatMessage]

# Global token storage
access_token_info: Optional[TokenInfo] = None

class GlooApiError(Exception):
    """Custom exception for Gloo AI API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

def get_access_token() -> TokenInfo:
    """
    Retrieve a new access token from the Gloo AI API.
    
    Returns:
        TokenInfo: Token information including access_token and expiration
        
    Raises:
        GlooApiError: If authentication fails
    """
    try:
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {"grant_type": "client_credentials", "scope": "api/access"}
        
        response = requests.post(
            TOKEN_URL, 
            headers=headers, 
            data=data, 
            auth=(CLIENT_ID, CLIENT_SECRET),
            timeout=30
        )
        response.raise_for_status()
        
        token_data = response.json()
        token_info = TokenInfo(
            access_token=token_data['access_token'],
            expires_in=token_data['expires_in'],
            expires_at=int(time.time()) + token_data['expires_in'],
            token_type=token_data['token_type']
        )
        
        return token_info
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Authentication failed: {str(e)}"
        if hasattr(e, 'response') and e.response:
            try:
                error_detail = e.response.json().get('detail', 'Unknown error')
                error_msg = f"Authentication failed: {error_detail}"
            except:
                error_msg = f"Authentication failed: HTTP {e.response.status_code}"
        raise GlooApiError(error_msg, getattr(e.response, 'status_code', None))

def is_token_expired(token_info: Optional[TokenInfo]) -> bool:
    """
    Check if the token is expired or close to expiring.
    
    Args:
        token_info: Token information to check
        
    Returns:
        bool: True if token is expired or missing
    """
    if not token_info:
        return True
    return time.time() > (token_info.expires_at - 60)

def ensure_valid_token() -> str:
    """
    Ensure we have a valid access token.
    
    Returns:
        str: Valid access token
        
    Raises:
        GlooApiError: If token acquisition fails
    """
    global access_token_info
    
    if is_token_expired(access_token_info):
        print("Getting new access token...")
        access_token_info = get_access_token()
    
    return access_token_info.access_token

def send_message(message_text: str, chat_id: Optional[str] = None) -> MessageResponse:
    """
    Send a message to the chat API.
    
    Args:
        message_text: The message to send
        chat_id: Optional chat ID to continue existing conversation
        
    Returns:
        MessageResponse: Response from the API
        
    Raises:
        GlooApiError: If message sending fails
    """
    try:
        token = ensure_valid_token()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "query": message_text,
            "character_limit": 1000,
            "sources_limit": 5,
            "stream": False,
            "publishers": [],
            "enable_suggestions": 1  # Enable suggested follow-up questions
        }
        
        if chat_id:
            payload["chat_id"] = chat_id
        
        response = requests.post(
            MESSAGE_API_URL, 
            headers=headers, 
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        
        data = response.json()
        return MessageResponse(
            chat_id=data['chat_id'],
            query_id=data['query_id'],
            message_id=data['message_id'],
            message=data['message'],
            timestamp=data['timestamp'],
            success=data['success'],
            suggestions=data.get('suggestions', []),
            sources=data.get('sources', [])
        )
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Message sending failed: {str(e)}"
        if hasattr(e, 'response') and e.response:
            try:
                error_detail = e.response.json().get('detail', 'Unknown error')
                error_msg = f"Message sending failed: {error_detail}"
            except:
                error_msg = f"Message sending failed: HTTP {e.response.status_code}"
        raise GlooApiError(error_msg, getattr(e.response, 'status_code', None))

def get_chat_history(chat_id: str) -> ChatHistory:
    """
    Retrieve the full chat history for a given chat ID.
    
    Args:
        chat_id: The chat ID to retrieve history for
        
    Returns:
        ChatHistory: Complete chat history
        
    Raises:
        GlooApiError: If history retrieval fails
    """
    try:
        token = ensure_valid_token()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        params = {"chat_id": chat_id}
        
        response = requests.get(
            CHAT_API_URL, 
            headers=headers, 
            params=params,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        
        messages = []
        for msg_data in data['messages']:
            message = ChatMessage(
                query_id=msg_data['query_id'],
                message_id=msg_data['message_id'],
                timestamp=msg_data['timestamp'],
                role=msg_data['role'],
                message=msg_data['message'],
                character_limit=msg_data.get('character_limit')
            )
            messages.append(message)
        
        return ChatHistory(
            chat_id=data['chat_id'],
            created_at=data['created_at'],
            messages=messages
        )
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Chat history retrieval failed: {str(e)}"
        if hasattr(e, 'response') and e.response:
            try:
                error_detail = e.response.json().get('detail', 'Unknown error')
                error_msg = f"Chat history retrieval failed: {error_detail}"
            except:
                error_msg = f"Chat history retrieval failed: HTTP {e.response.status_code}"
        raise GlooApiError(error_msg, getattr(e.response, 'status_code', None))

def format_timestamp(timestamp_str: str) -> str:
    """
    Format timestamp for display.
    
    Args:
        timestamp_str: ISO timestamp string
        
    Returns:
        str: Formatted timestamp
    """
    try:
        # Parse ISO timestamp
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return timestamp_str

def validate_environment() -> None:
    """
    Validate that required environment variables are set.
    
    Raises:
        SystemExit: If required environment variables are missing
    """
    if CLIENT_ID == "YOUR_CLIENT_ID" or CLIENT_SECRET == "YOUR_CLIENT_SECRET":
        print("❌ Please set your GLOO_CLIENT_ID and GLOO_CLIENT_SECRET environment variables")
        print("Create a .env file with:")
        print("GLOO_CLIENT_ID=your_client_id")
        print("GLOO_CLIENT_SECRET=your_client_secret")
        sys.exit(1)

def display_message(message: ChatMessage, index: int) -> None:
    """
    Display a chat message with formatting.
    
    Args:
        message: The message to display
        index: Message index for numbering
    """
    role = message.role.upper()
    timestamp = format_timestamp(message.timestamp)
    print(f"{index + 1}. {role} [{timestamp}]:")
    print(message.message)
    print()

def main() -> None:
    """
    Main function demonstrating the complete chat flow.
    """
    try:
        # Validate environment
        validate_environment()
        
        # Start with a deep, meaningful question about human flourishing
        initial_question = "How can I find meaning and purpose when facing life's greatest challenges?"
        
        print("=== Starting New Chat Session ===")
        print(f"Question: {initial_question}")
        print()
        
        # Create new chat session
        chat_response = send_message(initial_question)
        chat_id = chat_response.chat_id
        
        print("AI Response:")
        print(chat_response.message)
        print()
        
        # Show suggested follow-up questions
        if chat_response.suggestions:
            print("Suggested follow-up questions:")
            for i, suggestion in enumerate(chat_response.suggestions, 1):
                print(f"{i}. {suggestion}")
            print()
        
        # Use the first suggested question for follow-up, or fallback
        if chat_response.suggestions:
            follow_up_question = chat_response.suggestions[0]
        else:
            follow_up_question = "Can you give me practical steps I can take today to begin this journey?"
        
        print("=== Continuing the Conversation ===")
        print(f"Using suggested question: {follow_up_question}")
        print()
        
        # Send follow-up message
        follow_up_response = send_message(follow_up_question, chat_id)
        
        print("AI Response:")
        print(follow_up_response.message)
        print()
        
        # Display final chat history (optional)
        print("=== Complete Chat History (Optional) ===")
        print("This shows how to retrieve the complete conversation history:")
        print()
        
        chat_history = get_chat_history(chat_id)
        
        for i, message in enumerate(chat_history.messages):
            display_message(message, i)
        
        print("✅ Chat session completed successfully!")
        print(f"📊 Total messages: {len(chat_history.messages)}")
        print(f"🔗 Chat ID: {chat_id}")
        print(f"📅 Session created: {format_timestamp(chat_history.created_at)}")
        print()
        print("💡 Key Learning Points:")
        print("• Step 1: Authentication with OAuth2")
        print("• Step 2: Create chat with suggestions enabled")
        print("• Step 3: Continue conversation using chat_id (no history retrieval needed)")
        print("• Step 4: Optionally retrieve chat history for display")
        
    except GlooApiError as e:
        print(f"❌ API Error: {e.message}")
        if e.status_code:
            print(f"Status Code: {e.status_code}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()