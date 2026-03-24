"""
CLI typing-effect renderer for streaming completions.

Prints each token to stdout without newlines as it arrives, creating
a real-time typing effect in the terminal.
"""

from streaming.stream_client import (
    make_streaming_request,
    parse_sse_line,
    extract_token_content,
)


def render_stream_to_terminal(message: str, token: str) -> None:
    # TODO: Implement the typing-effect terminal renderer (Step 7):
    # 1. Print the prompt: print(f"Prompt: {message}\n")
    # 2. Print the response label without newline: print("Response: ", end="", flush=True)
    # 3. Call make_streaming_request(message, token) to open the stream
    # 4. Initialize total_tokens = 0, finish_reason = "unknown"
    # 5. Iterate response.iter_lines(decode_unicode=True):
    #    a. Parse with parse_sse_line — skip None, break on "[DONE]"
    #    b. Extract with extract_token_content — print immediately: print(content, end="", flush=True)
    #    c. Increment total_tokens, capture finish_reason
    # 6. Print final newline and summary: print(f"\n[{total_tokens} tokens, finish_reason={finish_reason}]")
    raise NotImplementedError("Not implemented - see TODO comments")
