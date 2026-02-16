#!/usr/bin/env node
/**
 * Grounded Completions Recipe - JavaScript Implementation
 *
 * This script demonstrates the difference between non-grounded and grounded
 * completions using Gloo AI's RAG (Retrieval-Augmented Generation) capabilities.
 *
 * It compares responses from a standard completion (which may hallucinate)
 * against a grounded completion (which uses your actual content).
 */

require('dotenv').config();

// Configuration
const GLOO_CLIENT_ID = process.env.GLOO_CLIENT_ID;
const GLOO_CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET;
const PUBLISHER_NAME = process.env.PUBLISHER_NAME || 'Bezalel';

// API Endpoints
const TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
const COMPLETIONS_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';
const GROUNDED_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions/grounded';

// Token management
let accessToken = null;
let tokenExpiry = null;

/**
 * Retrieve an OAuth2 access token from Gloo AI.
 *
 * @returns {Promise<Object>} Token response containing access_token and expires_in
 */
async function getAccessToken() {
  if (!GLOO_CLIENT_ID || !GLOO_CLIENT_SECRET) {
    throw new Error(
      'Missing credentials. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET ' +
      'environment variables.'
    );
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: GLOO_CLIENT_ID,
    client_secret: GLOO_CLIENT_SECRET
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

/**
 * Ensure we have a valid access token, refreshing if necessary.
 *
 * @returns {Promise<string>} Valid access token
 */
async function ensureValidToken() {
  // Check if we need a new token
  if (!accessToken || !tokenExpiry || Date.now() >= tokenExpiry) {
    const tokenData = await getAccessToken();
    accessToken = tokenData.access_token;
    // Set expiry with 5 minute buffer
    const expiresIn = tokenData.expires_in || 3600;
    tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
  }

  return accessToken;
}

/**
 * Make a standard V2 completion request WITHOUT grounding.
 *
 * This uses the model's general knowledge and may produce generic
 * or potentially inaccurate responses about your specific content.
 *
 * @param {string} query - The user's question
 * @returns {Promise<Object>} API response
 */
async function makeNonGroundedRequest(query) {
  const token = await ensureValidToken();

  const payload = {
    messages: [{ role: 'user', content: query }],
    auto_routing: true,
    max_tokens: 500
  };

  try {
    const response = await fetch(COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Non-grounded request failed: ${error.message}`);
  }
}

/**
 * Make a grounded completion request WITH RAG on your specific publisher.
 *
 * This retrieves relevant content from your publisher before generating
 * a response, resulting in accurate, source-backed answers specific to
 * your organization.
 *
 * @param {string} query - The user's question
 * @param {string} publisherName - Name of the publisher in Gloo Studio
 * @param {number} sourcesLimit - Maximum number of sources to use (default: 3)
 * @returns {Promise<Object>} API response with sources_returned flag
 */
async function makePublisherGroundedRequest(query, publisherName, sourcesLimit = 3) {
  const token = await ensureValidToken();

  const payload = {
    messages: [{ role: 'user', content: query }],
    auto_routing: true,
    rag_publisher: publisherName,
    sources_limit: sourcesLimit,
    max_tokens: 500
  };

  try {
    const response = await fetch(GROUNDED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Publisher grounded request failed: ${error.message}`);
  }
}

/**
 * Compare non-grounded vs publisher grounded responses.
 *
 * This is the main demo function that shows the difference between generic
 * responses and organization-specific answers through RAG.
 *
 * @param {string} query - The question to ask
 * @param {string} publisherName - Name of the publisher in Gloo Studio
 */
async function compareResponses(query, publisherName) {
  console.log('\n' + '='.repeat(80));
  console.log(`Query: ${query}`);
  console.log('='.repeat(80));

  // Non-grounded response
  console.log('\n🔹 STEP 1: NON-GROUNDED Response (Generic Model Knowledge):');
  console.log('-'.repeat(80));
  try {
    const nonGrounded = await makeNonGroundedRequest(query);
    const content = nonGrounded.choices[0].message.content;
    console.log(content);
    console.log(`\n📊 Metadata:`);
    console.log(`   Sources used: ${nonGrounded.sources_returned || false}`);
    console.log(`   Model: ${nonGrounded.model || 'N/A'}`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Publisher grounded response
  console.log('🔹 STEP 2: GROUNDED on Your Publisher (Your Specific Content):');
  console.log('-'.repeat(80));
  try {
    const publisherGrounded = await makePublisherGroundedRequest(query, publisherName);
    const content = publisherGrounded.choices[0].message.content;
    console.log(content);
    console.log(`\n📊 Metadata:`);
    console.log(`   Sources used: ${publisherGrounded.sources_returned || false}`);
    console.log(`   Model: ${publisherGrounded.model || 'N/A'}`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Prompt user for input (simulates blocking input in Node.js)
 */
function promptToContinue() {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press Enter to continue to next comparison...', () => {
      readline.close();
      resolve();
    });
  });
}

/**
 * Run the grounded completions comparison demo.
 *
 * Tests multiple queries to demonstrate the value of RAG in reducing
 * hallucinations and providing accurate, source-backed responses.
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  GROUNDED COMPLETIONS DEMO - Comparing RAG vs Non-RAG Responses');
  console.log('='.repeat(80));
  console.log(`\nPublisher: ${PUBLISHER_NAME}`);
  console.log('This demo shows a 2-step comparison:');
  console.log('  1. Non-grounded (generic model knowledge)');
  console.log('  2. Grounded on your publisher (your specific content)');
  console.log('\nNote: For org-specific queries like Bezalel\'s hiring process,');
  console.log('step 1 will lack specific details, while step 2 provides');
  console.log('accurate, source-backed answers from your content.\n');

  // Test queries that demonstrate clear differences
  const queries = [
    "What is Bezalel Ministries' hiring process?",
    "What educational resources does Bezalel Ministries provide?",
    "Describe Bezalel's research methodology for creating artwork."
  ];

  for (let i = 0; i < queries.length; i++) {
    console.log(`\n${'#'.repeat(80)}`);
    console.log(`# COMPARISON ${i + 1} of ${queries.length}`);
    console.log('#'.repeat(80));

    await compareResponses(queries[i], PUBLISHER_NAME);

    // Pause between comparisons for readability
    if (i < queries.length - 1) {
      await promptToContinue();
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('  Demo Complete!');
  console.log('='.repeat(80));
  console.log('\nKey Takeaways:');
  console.log('✓ Step 1 (Non-grounded): Generic model knowledge, may hallucinate');
  console.log('✓ Step 2 (Publisher grounded): Your specific content, accurate and');
  console.log('  source-backed (sources_returned: true)');
  console.log('✓ Grounding on your own content transforms generic AI into an accurate assistant');
  console.log('\nNext Steps:');
  console.log('• Upload your own content to a Publisher in Gloo Studio');
  console.log('• Update PUBLISHER_NAME in .env to use your content');
  console.log('• Try both general and specific queries to see the differences!');
  console.log('');
}

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

// Export functions for use as a module
module.exports = {
  getAccessToken,
  ensureValidToken,
  makeNonGroundedRequest,
  makePublisherGroundedRequest,
  compareResponses
};
