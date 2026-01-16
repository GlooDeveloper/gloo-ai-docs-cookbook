#!/usr/bin/env python3
"""
Gloo AI Realtime Content Ingestion - Python Example

This script demonstrates how to use the Gloo AI Realtime Ingestion API
to automatically upload content and make it available for search and AI interaction.
"""

import requests
import time
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
CLIENT_ID = os.getenv("GLOO_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token"
API_URL = "https://platform.ai.gloo.com/ingestion/v1/real_time_upload"
PUBLISHER_ID = "your-publisher-id"  # Replace with your publisher ID

# Validate credentials
if CLIENT_ID in ("YOUR_CLIENT_ID", "", None) or CLIENT_SECRET in ("YOUR_CLIENT_SECRET", "", None):
    print("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set")
    print("Create a .env file with your credentials:")
    print("GLOO_CLIENT_ID=your_client_id_here")
    print("GLOO_CLIENT_SECRET=your_client_secret_here")
    sys.exit(1)

# --- State Management ---
access_token_info: Dict[str, Any] = {}

class TokenManager:
    """Manages OAuth2 token lifecycle for API authentication."""

    @staticmethod
    def get_access_token() -> Dict[str, Any]:
        """Retrieves a new access token from the OAuth2 endpoint."""
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {"grant_type": "client_credentials", "scope": "api/access"}

        try:
            response = requests.post(
                TOKEN_URL,
                headers=headers,
                data=data,
                auth=(CLIENT_ID, CLIENT_SECRET),
                timeout=30
            )
            response.raise_for_status()

            token_data = response.json()
            token_data['expires_at'] = int(time.time()) + token_data['expires_in']
            return token_data

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to obtain access token: {e}")

    @staticmethod
    def is_token_expired(token_info: Dict[str, Any]) -> bool:
        """Checks if the token is expired or close to expiring."""
        if not token_info or 'expires_at' not in token_info:
            return True
        return time.time() > (token_info['expires_at'] - 60)  # 60 second buffer

class ContentProcessor:
    """Handles content processing and API uploads."""

    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager
        self.supported_extensions = {'.txt', '.md'}

    def is_supported_file(self, file_path: str) -> bool:
        """Check if file extension is supported for processing."""
        return Path(file_path).suffix.lower() in self.supported_extensions

    def extract_title_from_filename(self, filename: str) -> str:
        """Extract and format title from filename."""
        # Remove extension and replace underscores/hyphens with spaces
        title = Path(filename).stem
        title = title.replace('_', ' ').replace('-', ' ')
        # Capitalize each word
        return title.title()

    def create_content_data(self, content: str, title: str) -> Dict[str, Any]:
        """Create properly formatted content data for API upload."""
        return {
            "content": content,
            "publisherId": PUBLISHER_ID,
            "item_title": title,
            "author": ["Automated Ingestion"],
            "publication_date": datetime.now().strftime("%Y-%m-%d"),
            "type": "Article",
            "pub_type": "technical",
            "item_tags": ["automated", "ingestion"],
            "evergreen": True,
            "drm": ["aspen", "kallm"]
        }

    def upload_content(self, content_data: Dict[str, Any]) -> Dict[str, Any]:
        """Upload content to the Realtime API."""
        global access_token_info

        # Check and refresh token if needed
        if self.token_manager.is_token_expired(access_token_info):
            print("Token is expired or missing. Fetching a new one...")
            access_token_info = self.token_manager.get_access_token()

        headers = {
            "Authorization": f"Bearer {access_token_info['access_token']}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(
                API_URL,
                headers=headers,
                json=content_data,
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"API upload failed: {e}")

    def process_file(self, file_path: str) -> bool:
        """Process a single file and upload its content."""
        try:
            file_path = Path(file_path)

            if not file_path.exists():
                print(f"❌ File does not exist: {file_path}")
                return False

            if not self.is_supported_file(str(file_path)):
                print(f"❌ Unsupported file type: {file_path}")
                return False

            # Read file content
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
            except UnicodeDecodeError:
                print(f"❌ Failed to read file (encoding issue): {file_path}")
                return False

            if not content.strip():
                print(f"❌ File is empty: {file_path}")
                return False

            # Extract metadata
            title = self.extract_title_from_filename(file_path.name)
            content_data = self.create_content_data(content, title)

            # Upload content
            result = self.upload_content(content_data)

            print(f"✅ Successfully uploaded: {title}")
            print(f"   Response: {result['message']}")
            return True

        except Exception as e:
            print(f"❌ Failed to process {file_path}: {e}")
            return False

class ContentHandler(FileSystemEventHandler):
    """Handles file system events for content monitoring."""

    def __init__(self, processor: ContentProcessor):
        super().__init__()
        self.processor = processor

    def on_created(self, event):
        """Handle file creation events."""
        if not event.is_directory and self.processor.is_supported_file(event.src_path):
            print(f"📄 New file detected: {event.src_path}")
            # Allow file write to complete
            time.sleep(1)
            self.processor.process_file(event.src_path)

class RealtimeIngestionApp:
    """Main application class for Realtime Content Ingestion."""

    def __init__(self):
        self.token_manager = TokenManager()
        self.processor = ContentProcessor(self.token_manager)

    def start_file_watcher(self, watch_directory: str) -> None:
        """Start monitoring a directory for new content files."""
        watch_path = Path(watch_directory)

        # Create directory if it doesn't exist
        if not watch_path.exists():
            watch_path.mkdir(parents=True, exist_ok=True)
            print(f"Created watch directory: {watch_path}")

        print(f"🔍 Monitoring directory: {watch_path}")
        print("   Supported file types: .txt, .md")
        print("   Press Ctrl+C to stop")

        event_handler = ContentHandler(self.processor)
        observer = Observer()
        observer.schedule(event_handler, str(watch_path), recursive=True)

        observer.start()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 Stopping file monitor...")
            observer.stop()
        observer.join()

    def batch_process_directory(self, directory_path: str) -> None:
        """Process all supported files in a directory."""
        dir_path = Path(directory_path)

        if not dir_path.exists():
            print(f"Directory does not exist: {dir_path}")
            return

        if not dir_path.is_dir():
            print(f"Path is not a directory: {dir_path}")
            return

        # Find all supported files
        supported_files = []
        for ext in self.processor.supported_extensions:
            supported_files.extend(dir_path.glob(f"*{ext}"))

        if not supported_files:
            print(f"No supported files found in: {dir_path}")
            return

        print(f"Found {len(supported_files)} files to process")

        processed = 0
        failed = 0

        for file_path in supported_files:
            if self.processor.process_file(str(file_path)):
                processed += 1
            else:
                failed += 1

            # Rate limiting - avoid overwhelming the API
            time.sleep(1)

        print(f"\n📊 Batch processing complete:")
        print(f"   ✅ Processed: {processed} files")
        print(f"   ❌ Failed: {failed} files")

    def process_single_file(self, file_path: str) -> None:
        """Process a single file."""
        success = self.processor.process_file(file_path)
        if not success:
            sys.exit(1)

    def print_usage(self) -> None:
        """Print usage information."""
        print("Usage:")
        print("  python main.py watch <directory>     # Monitor directory for new files")
        print("  python main.py batch <directory>     # Process all files in directory")
        print("  python main.py single <file_path>    # Process single file")
        print()
        print("Examples:")
        print("  python main.py watch ./sample_content")
        print("  python main.py batch ./sample_content")
        print("  python main.py single ./sample_content/article.txt")

def main():
    """Main entry point."""
    app = RealtimeIngestionApp()

    if len(sys.argv) < 2:
        app.print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    try:
        if command == "watch":
            if len(sys.argv) < 3:
                print("Error: Please specify a directory to watch")
                app.print_usage()
                sys.exit(1)
            app.start_file_watcher(sys.argv[2])

        elif command == "batch":
            if len(sys.argv) < 3:
                print("Error: Please specify a directory to process")
                app.print_usage()
                sys.exit(1)
            app.batch_process_directory(sys.argv[2])

        elif command == "single":
            if len(sys.argv) < 3:
                print("Error: Please specify a file to process")
                app.print_usage()
                sys.exit(1)
            app.process_single_file(sys.argv[2])

        else:
            print(f"Error: Invalid command '{command}'")
            app.print_usage()
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n👋 Operation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
