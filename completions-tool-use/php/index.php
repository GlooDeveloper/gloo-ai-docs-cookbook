<?php
require_once 'vendor/autoload.php';

// Load environment variables from .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// --- Configuration ---
$API_KEY = $_ENV['GLOO_API_KEY'] ?? '';
$API_URL = 'https://platform.ai.gloo.com/ai/v2/guarded/chat/completions';

// Validate that API key is provided
if (empty($API_KEY)) {
    echo "Error: GLOO_API_KEY must be set\n";
    echo "Either:\n";
    echo "1. Create a .env file with your API key:\n";
    echo "   GLOO_API_KEY=your_api_key_here\n";
    echo "2. Export it as an environment variable:\n";
    echo "   export GLOO_API_KEY=\"your_api_key_here\"\n";
    exit(1);
}

function createGoalSettingRequest($userGoal, $apiUrl, $apiKey) {
    $tools = [
        [
            'type' => 'function',
            'function' => [
                'name' => 'create_growth_plan',
                'description' => 'Creates a structured personal growth plan with a title and a series of actionable steps.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'goal_title' => [
                            'type' => 'string',
                            'description' => 'A concise, encouraging title for the user\'s goal.'
                        ],
                        'steps' => [
                            'type' => 'array',
                            'description' => 'A list of concrete steps the user should take.',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'step_number' => ['type' => 'integer'],
                                    'action' => [
                                        'type' => 'string',
                                        'description' => 'The specific, actionable task for this step.'
                                    ],
                                    'timeline' => [
                                        'type' => 'string',
                                        'description' => 'A suggested timeframe for this step (e.g., \'Week 1-2\').'
                                    ]
                                ],
                                'required' => ['step_number', 'action', 'timeline']
                            ]
                        ]
                    ],
                    'required' => ['goal_title', 'steps']
                ]
            ]
        ]
    ];

    $payload = json_encode([
        'auto_routing' => true,
        'messages' => [['role' => 'user', 'content' => $userGoal]],
        'tools' => $tools,
        'tool_choice' => 'required'
    ]);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ]);

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("cURL error: " . $error);
    }
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("API error: $httpCode - Response: $result");
    }

    $responseData = json_decode($result, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON decode error: " . json_last_error_msg() . " - Response: $result");
    }

    return $responseData;
}

function parseGrowthPlan($apiResponse) {
    if (!isset($apiResponse['choices']) || empty($apiResponse['choices'])) {
        throw new Exception("No choices in API response: " . json_encode($apiResponse));
    }

    if (!isset($apiResponse['choices'][0]['message']['tool_calls']) ||
        empty($apiResponse['choices'][0]['message']['tool_calls'])) {
        throw new Exception("No tool calls in API response: " . json_encode($apiResponse));
    }

    $toolCall = $apiResponse['choices'][0]['message']['tool_calls'][0];

    if (!isset($toolCall['function']['arguments'])) {
        throw new Exception("No function arguments in tool call: " . json_encode($toolCall));
    }

    $growthPlan = json_decode($toolCall['function']['arguments'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON decode error for arguments: " . json_last_error_msg() .
                          " - Arguments: " . $toolCall['function']['arguments']);
    }

    return $growthPlan;
}

function displayGrowthPlan($growthPlan) {
    if (!isset($growthPlan['goal_title']) || !isset($growthPlan['steps'])) {
        throw new Exception("Invalid growth plan structure: " . json_encode($growthPlan));
    }

    echo "\n🎯 " . $growthPlan['goal_title'] . "\n";
    echo str_repeat("=", strlen($growthPlan['goal_title']) + 4) . "\n";

    if (!is_array($growthPlan['steps'])) {
        throw new Exception("Steps is not an array: " . json_encode($growthPlan['steps']));
    }

    foreach ($growthPlan['steps'] as $step) {
        if (!isset($step['step_number']) || !isset($step['action']) || !isset($step['timeline'])) {
            throw new Exception("Invalid step structure: " . json_encode($step));
        }
        echo "\n" . $step['step_number'] . ". " . $step['action'] . "\n";
        echo "   ⏰ Timeline: " . $step['timeline'] . "\n";
    }
}

// --- Main Execution ---
try {
    $userGoal = "I want to grow in my faith.";
    echo "Creating growth plan for: '$userGoal'\n";

    // Make API call with tool use
    $response = createGoalSettingRequest($userGoal, $API_URL, $API_KEY);

    // Parse the structured response
    $growthPlan = parseGrowthPlan($response);

    // Display the results
    displayGrowthPlan($growthPlan);

    // Also show raw JSON for developers
    echo "\n📊 Raw JSON output:\n";
    echo json_encode($growthPlan, JSON_PRETTY_PRINT) . "\n";

} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . "\n";
}
?>
