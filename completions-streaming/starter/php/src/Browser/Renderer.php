<?php

declare(strict_types=1);

namespace GlooStreaming\Browser;

use GlooStreaming\Streaming\StreamClient;

/**
 * CLI typing-effect renderer for streaming completions.
 *
 * Prints each token to stdout without buffering as it arrives,
 * creating a real-time typing effect in the terminal.
 */
class Renderer
{
    /**
     * Stream a completion and print tokens to stdout with a typing effect.
     *
     * Uses ob_flush() and flush() to push each token to the terminal
     * immediately without waiting for the stream to complete.
     *
     * @param string $message The user message to send
     * @param string $token Valid Bearer token for authorization
     */
    public static function renderStreamToTerminal(string $message, string $token): void
    {
        // TODO: Implement the typing-effect terminal renderer (Step 7):
        // 1. Print the prompt header and flush the output buffer, initializing tracking variables
        // 2. Define a write callback closure that receives raw data chunks from the stream
        // 3. Inside the callback, split each chunk into lines, parse each SSE line, and stop on the stream termination signal
        // 4. Extract content from valid chunks and echo each token immediately, flushing after each one
        // 5. Track the total token count and capture the finish reason from the final chunk
        // 6. Call makeStreamingRequest with the message, token, and callback to execute the stream
        // 7. Print a final newline followed by the token count and finish reason summary
        throw new \RuntimeException('Not implemented - see TODO comments');
    }
}
