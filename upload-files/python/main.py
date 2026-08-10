#!/usr/bin/env python3
"""
Gloo AI Upload Files - Python Example

This script demonstrates how to use the Gloo AI Data Engine Files API
to upload files directly for processing and AI-powered search.
"""

import requests
import time
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
API_KEY = os.getenv("GLOO_API_KEY", "")
PUBLISHER_ID = os.getenv("GLOO_PUBLISHER_ID", "your-publisher-id")

UPLOAD_URL = "https://platform.ai.gloo.com/ingestion/v2/files"
METADATA_URL = "https://platform.ai.gloo.com/engine/v2/item"

# Supported file extensions
SUPPORTED_EXTENSIONS = {'.txt', '.md', '.pdf', '.doc', '.docx'}

# Validate credentials
if not API_KEY:
    print("Error: GLOO_API_KEY must be set")
    print("Create a .env file with your credentials:")
    print("GLOO_API_KEY=your_api_key_here")
    print("GLOO_PUBLISHER_ID=your_publisher_id_here")
    sys.exit(1)


class FileUploader:
    """Handles file uploads to the Data Engine Files API."""

    def is_supported_file(self, file_path: str) -> bool:
        """Check if file extension is supported for upload."""
        return Path(file_path).suffix.lower() in SUPPORTED_EXTENSIONS

    def upload_single_file(self, file_path: str, producer_id: Optional[str] = None) -> Dict[str, Any]:
        """Upload a single file to the Data Engine."""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if not self.is_supported_file(str(file_path)):
            raise ValueError(f"Unsupported file type: {file_path.suffix}")

        headers = {"Authorization": f"Bearer {API_KEY}"}

        params = {}
        if producer_id:
            params["producer_id"] = producer_id

        try:
            with open(file_path, 'rb') as f:
                files = {"files": (file_path.name, f)}
                data = {"publisher_id": PUBLISHER_ID}
                response = requests.post(
                    UPLOAD_URL,
                    headers=headers,
                    files=files,
                    data=data,
                    params=params if params else None,
                    timeout=120
                )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Upload failed: {e}")

    def upload_multiple_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """Upload multiple files to the Data Engine in a single request."""
        headers = {"Authorization": f"Bearer {API_KEY}"}

        files = []
        open_files = []

        try:
            for file_path in file_paths:
                path = Path(file_path)
                if not path.exists():
                    print(f"Warning: Skipping non-existent file: {file_path}")
                    continue
                if not self.is_supported_file(str(path)):
                    print(f"Warning: Skipping unsupported file: {file_path}")
                    continue

                f = open(path, 'rb')
                open_files.append(f)
                files.append(('files', (path.name, f)))

            if not files:
                raise ValueError("No valid files to upload")

            data = {"publisher_id": PUBLISHER_ID}
            response = requests.post(
                UPLOAD_URL,
                headers=headers,
                files=files,
                data=data,
                timeout=300
            )
            response.raise_for_status()
            return response.json()

        finally:
            for f in open_files:
                f.close()

    def update_metadata(self, item_id: Optional[str] = None, producer_id: Optional[str] = None, **metadata) -> Dict[str, Any]:
        """Update metadata for an uploaded item."""
        if not item_id and not producer_id:
            raise ValueError("Either item_id or producer_id must be provided")

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        data = {"publisher_id": PUBLISHER_ID}
        if item_id:
            data["item_id"] = item_id
        if producer_id:
            data["producer_id"] = producer_id
        data.update(metadata)

        try:
            response = requests.post(
                METADATA_URL,
                headers=headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Metadata update failed: {e}")


class UploadFilesApp:
    """Main application class for file uploads."""

    def __init__(self):
        self.uploader = FileUploader()

    def upload_single(self, file_path: str, producer_id: Optional[str] = None) -> None:
        """Upload a single file."""
        try:
            print(f"Uploading: {file_path}")
            if producer_id:
                print(f"  Producer ID: {producer_id}")

            result = self.uploader.upload_single_file(file_path, producer_id)

            print(f"Upload successful!")
            print(f"  Message: {result.get('message', 'N/A')}")

            if result.get('ingesting'):
                print(f"  Ingesting: {len(result['ingesting'])} file(s)")
                for item_id in result['ingesting']:
                    print(f"    - {item_id}")

            if result.get('duplicates'):
                print(f"  Duplicates: {len(result['duplicates'])} file(s)")
                for item_id in result['duplicates']:
                    print(f"    - {item_id}")

        except Exception as e:
            print(f"Upload failed: {e}")
            sys.exit(1)

    def upload_batch(self, directory_path: str) -> None:
        """Upload all supported files in a directory."""
        dir_path = Path(directory_path)

        if not dir_path.exists():
            print(f"Directory does not exist: {dir_path}")
            sys.exit(1)

        if not dir_path.is_dir():
            print(f"Path is not a directory: {dir_path}")
            sys.exit(1)

        # Find all supported files
        file_paths = []
        for ext in SUPPORTED_EXTENSIONS:
            file_paths.extend(dir_path.glob(f"*{ext}"))

        if not file_paths:
            print(f"No supported files found in: {dir_path}")
            return

        print(f"Found {len(file_paths)} file(s) to upload")

        # Upload files one by one for better error handling and progress
        processed = 0
        failed = 0

        for file_path in file_paths:
            try:
                print(f"\nUploading: {file_path.name}")
                result = self.uploader.upload_single_file(str(file_path))

                if result.get('ingesting'):
                    print(f"  Ingesting: {result['ingesting'][0]}")
                    processed += 1
                elif result.get('duplicates'):
                    print(f"  Duplicate detected: {result['duplicates'][0]}")
                    processed += 1
                else:
                    print(f"  Result: {result.get('message', 'Unknown')}")
                    processed += 1

            except Exception as e:
                print(f"  Failed: {e}")
                failed += 1

            # Rate limiting
            time.sleep(1)

        print(f"\nBatch upload complete:")
        print(f"  Processed: {processed} file(s)")
        print(f"  Failed: {failed} file(s)")

    def upload_with_metadata(self, file_path: str, **metadata) -> None:
        """Upload a file and immediately add metadata."""
        try:
            # Generate a producer ID for tracking
            producer_id = f"upload-{int(time.time())}"

            print(f"Uploading: {file_path}")
            print(f"  Producer ID: {producer_id}")

            result = self.uploader.upload_single_file(file_path, producer_id)

            if result.get('ingesting'):
                item_id = result['ingesting'][0]
                print(f"  Item ID: {item_id}")

                # Add metadata if provided
                if metadata:
                    print("Updating metadata...")
                    meta_result = self.uploader.update_metadata(item_id=item_id, **metadata)
                    print(f"  Metadata updated: {meta_result.get('message', 'Success')}")
            else:
                print(f"  Result: {result.get('message', 'Unknown')}")

        except Exception as e:
            print(f"Operation failed: {e}")
            sys.exit(1)

    def print_usage(self) -> None:
        """Print usage information."""
        print("Usage:")
        print("  python main.py single <file_path> [producer_id]  # Upload single file")
        print("  python main.py batch <directory>                  # Upload all files in directory")
        print("  python main.py meta <file_path> --title <title>   # Upload with metadata")
        print()
        print("Examples:")
        print("  python main.py single ./sample_files/developer_happiness.txt")
        print("  python main.py single ./sample_files/developer_happiness.txt my-doc-001")
        print("  python main.py batch ./sample_files")
        print('  python main.py meta ./sample_files/developer_happiness.txt --title "Developer Happiness"')


def main():
    """Main entry point."""
    app = UploadFilesApp()

    if len(sys.argv) < 2:
        app.print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    try:
        if command == "single":
            if len(sys.argv) < 3:
                print("Error: Please specify a file to upload")
                app.print_usage()
                sys.exit(1)

            file_path = sys.argv[2]
            producer_id = sys.argv[3] if len(sys.argv) > 3 else None
            app.upload_single(file_path, producer_id)

        elif command == "batch":
            if len(sys.argv) < 3:
                print("Error: Please specify a directory")
                app.print_usage()
                sys.exit(1)

            app.upload_batch(sys.argv[2])

        elif command == "meta":
            if len(sys.argv) < 3:
                print("Error: Please specify a file to upload")
                app.print_usage()
                sys.exit(1)

            file_path = sys.argv[2]
            metadata = {}

            # Parse metadata arguments
            i = 3
            while i < len(sys.argv):
                if sys.argv[i] == "--title" and i + 1 < len(sys.argv):
                    metadata["item_title"] = sys.argv[i + 1]
                    i += 2
                elif sys.argv[i] == "--author" and i + 1 < len(sys.argv):
                    metadata["author"] = [sys.argv[i + 1]]
                    i += 2
                elif sys.argv[i] == "--tags" and i + 1 < len(sys.argv):
                    metadata["item_tags"] = sys.argv[i + 1].split(",")
                    i += 2
                else:
                    i += 1

            app.upload_with_metadata(file_path, **metadata)

        else:
            print(f"Error: Invalid command '{command}'")
            app.print_usage()
            sys.exit(1)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
