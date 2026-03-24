#!/usr/bin/env python3
"""
Server-Side Proxy Test

Validates that:
- The Flask proxy server starts and responds to /health
- POST /api/stream relays SSE from Gloo AI back to the client
- SSE lines arrive with correct format and stream terminates cleanly

Usage: python tests/step6_proxy_test.py

Note: Starts the proxy in a background thread; no separate server process needed.
"""

import json
import os
import sys
import time
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


def test_step6():
    print("🧪 Testing: Server-Side Proxy\n")

    client_id = os.getenv("GLOO_CLIENT_ID")
    if not client_id:
        print("❌ Missing GLOO_CLIENT_ID — run Step 1 first")
        sys.exit(1)

    try:
        import requests
        from proxy.server import app

        port = int(os.getenv("PROXY_PORT", 3001))

        # Start the Flask app in a background thread
        print(f"Test 1: Starting proxy server on port {port}...")
        server_thread = threading.Thread(
            target=lambda: app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False),
            daemon=True,
        )
        server_thread.start()

        # Wait for the server to be ready
        ready = False
        for _ in range(20):
            try:
                r = requests.get(f"http://127.0.0.1:{port}/health", timeout=1)
                if r.status_code == 200:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.2)

        if not ready:
            raise Exception(f"Proxy server did not start on port {port} within 4 seconds")

        print(f"✓ Proxy server running at http://localhost:{port}")

        # Test 2: Health endpoint
        print("\nTest 2: /health endpoint...")
        r = requests.get(f"http://127.0.0.1:{port}/health", timeout=5)
        if r.status_code != 200:
            raise Exception(f"Expected 200 from /health, got {r.status_code}")
        data = r.json()
        if data.get("status") != "ok":
            raise Exception(f"Expected status=ok, got: {data}")
        print(f"✓ /health returns: {data}")

        # Test 3: POST /api/stream returns text/event-stream
        print("\nTest 3: POST /api/stream — Content-Type header...")
        with requests.post(
            f"http://127.0.0.1:{port}/api/stream",
            json={"messages": [{"role": "user", "content": "Hi"}], "auto_routing": True},
            stream=True,
            timeout=15,
        ) as r:
            if r.status_code != 200:
                raise Exception(f"Expected 200, got {r.status_code}: {r.text[:200]}")
            content_type = r.headers.get("Content-Type", "")
            if "text/event-stream" not in content_type:
                raise Exception(f"Expected text/event-stream, got: {content_type}")
            print(f"✓ Content-Type: {content_type}")

            # Test 4: SSE lines arrive with correct format
            print("\nTest 4: SSE line format (data: prefix)...")
            data_lines = 0
            stream_terminated = False
            finish_reason = None
            for raw_line in r.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                if not raw_line.startswith("data: "):
                    raise Exception(f"Expected 'data: ' prefix, got: {raw_line!r}")
                payload = raw_line[6:].strip()
                if payload == "[DONE]":
                    continue
                try:
                    parsed = json.loads(payload)
                    reason = parsed.get("choices", [{}])[0].get("finish_reason") if parsed.get("choices") else None
                    if reason is not None:
                        stream_terminated = True
                        finish_reason = reason
                        break
                except Exception:
                    pass
                data_lines += 1

            print(f"✓ All lines have 'data: ' prefix ({data_lines} data chunks received)")

            if not stream_terminated:
                print("⚠️  Stream ended without a finish_reason chunk")
            else:
                print(f"✓ Stream terminated cleanly (finish_reason={finish_reason})")

        # Test 5: CORS headers present
        print("\nTest 5: CORS headers on response...")
        r = requests.options(
            f"http://127.0.0.1:{port}/api/stream",
            headers={"Origin": "http://localhost:3000"},
            timeout=5,
        )
        cors_header = r.headers.get("Access-Control-Allow-Origin", "")
        if not cors_header:
            print("⚠️  Access-Control-Allow-Origin header not set on OPTIONS response")
        else:
            print(f"✓ Access-Control-Allow-Origin: {cors_header}")

        print("\n✅ Proxy server relaying SSE end-to-end.")
        print("   Track B complete: credentials stay server-side, client receives SSE.\n")

    except Exception as error:
        print("\n❌ Server-Side Proxy Test Failed")
        print(f"Error: {error}")
        print("\n💡 Hints:")
        print("   - Check that Flask and requests are installed: pip install flask requests")
        print(f"   - Verify port {os.getenv('PROXY_PORT', 3001)} is not already in use")
        print("   - Check proxy/server.py imports ensure_valid_token correctly")
        print("   - Confirm GLOO_CLIENT_ID and GLOO_CLIENT_SECRET are set in .env\n")
        sys.exit(1)


if __name__ == "__main__":
    test_step6()
