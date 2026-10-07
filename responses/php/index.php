<?php

/**
 * Gloo AI Guarded Responses API Recipe - PHP
 *
 * This example demonstrates four features of the Gloo AI Responses API
 * (POST /ai/v2/guarded/responses): basic guarded responses with tradition,
 * instructions + multi-turn input, streaming (SSE), and vision (image input).
 */

require __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// Configuration
const API_URL = 'https://platform.ai.gloo.com/ai/v2/guarded/responses';

$apiKey = $_ENV['GLOO_API_KEY'] ?? getenv('GLOO_API_KEY') ?: 'YOUR_API_KEY';

/**
 * True when a .env value is an unset placeholder (empty or a TODO comment).
 */
function envIsPlaceholder(string $value): bool
{
    $stripped = trim($value);
    return $stripped === '' || str_starts_with($stripped, '#');
}

/**
 * Env value or default, ignoring unset placeholders (empty / TODO comments).
 */
function env(string $name, string $default): string
{
    $value = $_ENV[$name] ?? getenv($name);
    if ($value === false || !is_string($value) || envIsPlaceholder($value)) {
        return $default;
    }
    return $value;
}

$model = env('GLOO_MODEL', 'gloo-anthropic-claude-sonnet-4.6');
$visionModel = env('GLOO_VISION_MODEL', 'gloo-google-gemini-3.1-pro');
$visionImageUrl = env('VISION_IMAGE_URL', 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg');

/**
 * POST a request, returning a clear error (including the response body) on failure.
 */
function postJson(string $payload): array
{
    global $apiKey;
    $ch = curl_init(API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);
    $body = curl_exec($ch);
    if ($body === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('API request failed: ' . $error);
    }
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($status < 200 || $status >= 300) {
        $hint = $status === 403 ? ' (guardrails hard-blocked this request)' : '';
        throw new RuntimeException("API request failed with status {$status}{$hint}: {$body}");
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Failed to parse API response as JSON: {$body}");
    }
    return $decoded;
}

/**
 * Extract assistant text from a Responses API payload's output[] array.
 */
function extractText(array $result): string
{
    $parts = [];
    foreach ($result['output'] ?? [] as $item) {
        if (($item['type'] ?? null) !== 'message') {
            continue;
        }
        foreach ($item['content'] ?? [] as $content) {
            if (($content['type'] ?? null) === 'output_text') {
                $parts[] = $content['text'] ?? '';
            }
        }
    }
    return implode("\n", $parts);
}

/**
 * Example 1: Basic guarded response with a theological tradition.
 */
function makeBasicResponse(string $message, string $tradition = 'evangelical'): array
{
    global $model;
    return postJson(json_encode([
        'model' => $model,
        'input' => $message,
        'tradition' => $tradition,
        'max_output_tokens' => 256,
    ]));
}

/**
 * Example 2: Instructions plus multi-turn input array (alternating user/assistant roles).
 */
function makeInstructionsResponse(string $instructions, array $inputItems): array
{
    global $model;
    return postJson(json_encode([
        'model' => $model,
        'instructions' => $instructions,
        'input' => $inputItems,
        'max_output_tokens' => 256,
    ]));
}

/**
 * Example 3: Streaming via SSE; returns [accumulated_text, usage].
 */
function streamResponse(string $message): array
{
    global $apiKey, $model;
    $payload = json_encode([
        'model' => $model,
        'input' => $message,
        'stream' => true,
        'max_output_tokens' => 256,
    ]);

    $ch = curl_init(API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
            'Accept: text/event-stream',
        ],
        CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$state): int {
            $state['buffer'] .= $chunk;
            // SSE events are separated by blank lines; process every complete event.
            while (($pos = strpos($state['buffer'], "\n\n")) !== false) {
                $rawEvent = substr($state['buffer'], 0, $pos);
                $state['buffer'] = substr($state['buffer'], $pos + 2);
                processEvent($rawEvent, $state);
            }
            return strlen($chunk);
        },
    ]);
    $state = ['buffer' => '', 'event' => null, 'text_parts' => [], 'done_parts' => [], 'usage' => null, 'error' => null];

    // Note: each data: payload is the flattened event object itself (its "type"
    // matches the event: line); there is no nested "response" key, and the
    // response.completed payload carries usage but not the output[] array.
    curl_exec($ch);
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('API request failed: ' . $error);
    }
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($status < 200 || $status >= 300) {
        $hint = $status === 403 ? ' (guardrails hard-blocked this request)' : '';
        throw new RuntimeException("API request failed with status {$status}{$hint}: {$state['buffer']}");
    }
    if ($state['error'] !== null) {
        throw new RuntimeException($state['error']);
    }

    // Flush any final event not terminated by a blank line.
    if (trim($state['buffer']) !== '') {
        processEvent($state['buffer'], $state);
    }

    echo PHP_EOL;
    $text = implode('', $state['text_parts']) ?: implode('', $state['done_parts']);
    return [$text, $state['usage']];
}

/**
 * Process one raw SSE event block (event:/data: lines), mutating $state.
 */
function processEvent(string $rawEvent, array &$state): void
{
    $event = null;
    $data = null;
    foreach (preg_split('/\r?\n/', $rawEvent) as $line) {
        if (str_starts_with($line, 'event:')) {
            $event = trim(substr($line, strlen('event:')));
        } elseif (str_starts_with($line, 'data:')) {
            $rawData = trim(substr($line, strlen('data:')));
            $data = json_decode($rawData, true);
            // Empty data lines are tolerated; malformed JSON data is a terminal
            // error, matching the other languages (never silently skipped).
            if ($data === null && json_last_error() !== JSON_ERROR_NONE && trim($rawData) !== '') {
                $state['error'] = "Stream terminated by malformed SSE data: {$rawData}";
                return;
            }
        }
    }

    if ($event === 'response.output_text.delta') {
        $delta = $data['delta'] ?? '';
        echo $delta;
        $state['text_parts'][] = $delta;
    } elseif ($event === 'response.output_text.done') {
        $state['done_parts'][] = $data['text'] ?? '';
    } elseif ($event === 'response.completed') {
        // Docs nest the final response under "response"; the live API
        // flattens it into the payload itself. Accept both shapes.
        $final = $data['response'] ?? $data;
        $state['usage'] = $final['usage'] ?? null;
        if (empty($state['text_parts']) && empty($state['done_parts'])) {
            $state['done_parts'][] = extractText($final);
        }
    } elseif ($event !== null && str_starts_with($event, 'response.')) {
        // Other lifecycle events (response.created, response.in_progress,
        // response.output_item.*, response.content_part.*, ...).
    } elseif ($event !== null && str_starts_with($event, 'error')) {
        // Error events are terminal.
        $state['error'] = "Stream error event '{$event}': " . json_encode($data);
    } else {
        // Unknown event: treat as terminal and close the stream.
        $state['error'] = "Stream terminated by unknown event '{$event}': " . json_encode($data);
    }
}

/**
 * Example 4: Vision — image input via typed content parts.
 */
function makeVisionResponse(string $imageUrl, string $question): array
{
    global $visionModel;
    return postJson(json_encode([
        'model' => $visionModel,
        'input' => [
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'input_text', 'text' => $question],
                    ['type' => 'input_image', 'image_url' => $imageUrl],
                ],
            ],
        ],
        'max_output_tokens' => 256,
    ]));
}

/**
 * Run all four examples against the live API.
 */
function testResponsesApi(): bool
{
    global $model, $visionImageUrl;
    echo "=== Gloo AI Guarded Responses API Test ===\n\n";

    try {
        // Example 1: Basic guarded response with tradition
        echo "Example 1: Basic Guarded Response (tradition=evangelical)\n";
        echo "Testing: How can our small group support a grieving member?\n";
        $result1 = makeBasicResponse('How can our small group support a grieving member?');
        echo '   Model used: ' . ($result1['model'] ?? 'N/A') . "\n";
        $text1 = extractText($result1);
        echo '   Response: ' . mb_substr($text1, 0, 100) . "...\n";
        echo '   Usage: ' . json_encode($result1['usage'] ?? 'N/A') . "\n";
        echo "   ✓ Example 1 passed\n\n";

        // Example 2: Instructions + multi-turn input
        echo "Example 2: Instructions + Multi-turn Input\n";
        echo "Testing: three-turn conversation (user → assistant → user) with pastoral-care instructions\n";
        $result2 = makeInstructionsResponse(
            'You are a compassionate pastoral assistant. Keep answers brief and warm.',
            [
                [
                    'role' => 'user',
                    'content' => "I've been asked to lead a grief support group at church. Where do I start?",
                ],
                [
                    'role' => 'assistant',
                    'content' => "That's a meaningful calling. Start with prayerful preparation — ask God to prepare your own heart before you prepare the room.",
                ],
                [
                    'role' => 'user',
                    'content' => 'What should I do in the very first meeting?',
                ],
            ]
        );
        echo '   Model used: ' . ($result2['model'] ?? 'N/A') . "\n";
        $text2 = extractText($result2);
        echo '   Response: ' . mb_substr($text2, 0, 100) . "...\n";
        echo '   Usage: ' . json_encode($result2['usage'] ?? 'N/A') . "\n";
        echo "   ✓ Example 2 passed\n\n";

        // Example 3: Streaming
        echo "Example 3: Streaming (SSE)\n";
        echo "Testing: Write a one-paragraph prayer for a new season of ministry.\n";
        [$text3, $usage3] = streamResponse('Write a one-paragraph prayer for a new season of ministry.');
        echo '   Model used: ' . $model . "\n";
        echo '   Streamed text (' . mb_strlen($text3) . ' chars): ' . mb_substr($text3, 0, 100) . "...\n";
        echo '   Usage: ' . json_encode($usage3 ?? 'N/A') . "\n";
        if ($text3 === '') {
            throw new RuntimeException('streaming produced no text');
        }
        if ($usage3 === null) {
            throw new RuntimeException('streaming produced no usage');
        }
        echo "   ✓ Example 3 passed\n\n";

        // Example 4: Vision
        echo "Example 4: Vision (Image Input)\n";
        echo "Testing: {$visionImageUrl}\n";
        $result4 = makeVisionResponse($visionImageUrl, 'What animal is in this image?');
        echo '   Model used: ' . ($result4['model'] ?? 'N/A') . "\n";
        $text4 = extractText($result4);
        echo '   Response: ' . mb_substr($text4, 0, 100) . "...\n";
        echo '   Usage: ' . json_encode($result4['usage'] ?? 'N/A') . "\n";
        echo "   ✓ Example 4 passed\n\n";

        echo "=== All Responses API tests passed! ===\n";
        return true;
    } catch (Exception $e) {
        echo '✗ Test failed: ' . $e->getMessage() . "\n";
        return false;
    }
}

/**
 * Main execution.
 */
function main(): void
{
    global $apiKey;
    if (trim($apiKey) === '' || $apiKey === 'YOUR_API_KEY') {
        echo "Please set your GLOO_API_KEY environment variable\n";
        echo "You can create a .env file with:\n";
        echo "GLOO_API_KEY=your_api_key\n";
        return;
    }

    if (!testResponsesApi()) {
        exit(1);
    }
}

main();
