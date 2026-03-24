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
        // 1. Echo the prompt header: echo "Prompt: {$message}\n\nResponse: "
        // 2. Flush output buffers: ob_flush(); flush()
        // 3. Initialize $totalTokens = 0, $finishReason = 'unknown'
        // 4. Define a $writeCallback that:
        //    a. Splits $data on "\n", calls parseSseLine() on each line
        //    b. Skips null; breaks on '[DONE]'
        //    c. extractTokenContent() — echo immediately and flush: echo $content; ob_flush(); flush()
        //    d. Increments $totalTokens, captures $finishReason
        // 5. Call StreamClient::makeStreamingRequest($message, $token, $writeCallback)
        // 6. Echo summary: echo "\n\n[{$totalTokens} tokens, finish_reason={$finishReason}]\n"
        throw new \RuntimeException('Not implemented - see TODO comments');
    }
}
