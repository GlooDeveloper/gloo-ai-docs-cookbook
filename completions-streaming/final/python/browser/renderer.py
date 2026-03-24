"""
CLI typing-effect renderer for streaming completions.

Prints each token to stdout without newlines as it arrives, creating
a real-time typing effect in the terminal.
"""

from streaming.stream_client import make_streaming_request, parse_sse_line, extract_token_content


def render_stream_to_terminal(message: str, token: str) -> None:
    """
    Stream a completion and print tokens to stdout with a typing effect.

    Each content token is written immediately without buffering, so the
    user sees text appear character-by-character in the terminal.

    Args:
        message: The user message to send
        token: Valid Bearer token for authorization
    """
    print(f"Prompt: {message}\n")
    print("Response: ", end="", flush=True)

    response = make_streaming_request(message, token)

    total_tokens = 0
    finish_reason = "unknown"

    for raw_line in response.iter_lines(decode_unicode=True):
        chunk = parse_sse_line(raw_line)
        if chunk is None:
            continue
        if chunk == "[DONE]":
            break
        content = extract_token_content(chunk)
        if content:
            print(content, end="", flush=True)
            total_tokens += 1
        choices = chunk.get("choices", [])
        if choices and choices[0].get("finish_reason"):
            finish_reason = choices[0]["finish_reason"]

    # Final newline after stream ends
    print()
    print(f"\n[{total_tokens} tokens, finish_reason={finish_reason}]")
