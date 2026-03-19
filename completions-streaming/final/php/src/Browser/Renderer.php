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
        echo "Prompt: {$message}\n\nResponse: ";

        $totalTokens = 0;
        $finishReason = 'unknown';
        $lineBuffer = '';
        $done = false;

        $writeCallback = function (string $data) use (
            &$totalTokens, &$finishReason, &$lineBuffer, &$done
        ): void {
            if ($done) return;

            $lineBuffer .= $data;
            $lines = explode("\n", $lineBuffer);
            $lineBuffer = array_pop($lines);

            foreach ($lines as $line) {
                $chunk = StreamClient::parseSseLine($line);
                if ($chunk === null) continue;
                if ($chunk === '[DONE]') {
                    $done = true;
                    break;
                }
                $content = StreamClient::extractTokenContent($chunk);
                if ($content !== '') {
                    echo $content;
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                    $totalTokens++;
                }
                $choices = $chunk['choices'] ?? [];
                if (!empty($choices) && !empty($choices[0]['finish_reason'])) {
                    $finishReason = $choices[0]['finish_reason'];
                }
            }
        };

        StreamClient::makeStreamingRequest($message, $token, $writeCallback);

        echo "\n\n[{$totalTokens} tokens, finish_reason={$finishReason}]\n";
    }
}
