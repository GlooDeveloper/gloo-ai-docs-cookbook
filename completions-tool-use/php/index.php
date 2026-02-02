<?php
require_once 'vendor/autoload.php';

// Load environment variables from .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// --- Configuration ---
$CLIENT_ID = $_ENV['GLOO_CLIENT_ID'] ?? 'YOUR_CLIENT_ID';
$CLIENT_SECRET = $_ENV['GLOO_CLIENT_SECRET'] ?? 'YOUR_CLIENT_SECRET';
$TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
$API_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

// Validate credentials
if ($CLIENT_ID === 'YOUR_CLIENT_ID' || $CLIENT_SECRET === 'YOUR_CLIENT_SECRET' || 
    empty($CLIENT_ID) || empty($CLIENT_SECRET)) {
    echo "Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set\n";
    echo "Either:\n";
    echo "1. Create a .env file with your credentials:\n";
    echo "   GLOO_CLIENT_ID=your_client_id_here\n";
    echo "   GLOO_CLIENT_SECRET=your_client_secret_here\n";
    echo "2. Export them as environment variables:\n";
    echo "   export GLOO_CLIENT_ID=\"your_client_id_here\"\n";
    echo "   export GLOO_CLIENT_SECRET=\"your_client_secret_here\"\n";
    exit(1);
}

// --- State Management ---
$tokenInfo = [];

function getAccessToken($clientId, $clientSecret, $tokenUrl) {
    $postData = 'grant_type=client_credentials&scope=api/access';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_USERPWD, $clientId . ':' . $clientSecret);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("cURL error: " . $error);
    }
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("HTTP error: $httpCode - Response: $result");
    }
    
    $tokenData = json_decode($result, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON decode error: " . json_last_error_msg() . " - Response: $result");
    }
    
    if (!isset($tokenData['access_token']) || !isset($tokenData['expires_in'])) {
        throw new Exception("Invalid token response: " . json_encode($tokenData));
    }
    
    $tokenData['expires_at'] = time() + $tokenData['expires_in'];
    return $tokenData;
}

function isTokenExpired($token) {
    if (empty($token) || !isset($token['expires_at'])) return true;
    return time() > ($token['expires_at'] - 60);
}

function createGoalSettingRequest($userGoal, $apiUrl, &$tokenInfo, $clientId, $clientSecret, $tokenUrl) {
    if (isTokenExpired($tokenInfo)) {
        echo "Token is expired or missing. Fetching a new one...\n";
        $tokenInfo = getAccessToken($clientId, $clientSecret, $tokenUrl);
    }

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
        'Authorization: Bearer ' . $tokenInfo['access_token'],
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
    $response = createGoalSettingRequest($userGoal, $API_URL, $tokenInfo, $CLIENT_ID, $CLIENT_SECRET, $TOKEN_URL);
    
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