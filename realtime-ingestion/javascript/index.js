const axios = require("axios");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
require("dotenv").config();

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const API_URL = "https://platform.ai.gloo.com/ingestion/v1/real_time_upload";
const PUBLISHER_ID = "your-publisher-id"; // Replace with your publisher ID

// Validate credentials
if (
  CLIENT_ID === "YOUR_CLIENT_ID" ||
  CLIENT_SECRET === "YOUR_CLIENT_SECRET" ||
  !CLIENT_ID ||
  !CLIENT_SECRET
) {
  console.error("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set");
  console.log("Create a .env file with your credentials:");
  console.log("GLOO_CLIENT_ID=your_client_id_here");
  console.log("GLOO_CLIENT_SECRET=your_client_secret_here");
  process.exit(1);
}

// --- State Management ---
let tokenInfo = {};

async function getAccessToken() {
  const body = "grant_type=client_credentials&scope=api/access";
  const response = await axios.post(TOKEN_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: { username: CLIENT_ID, password: CLIENT_SECRET },
  });
  const tokenData = response.data;
  tokenData.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
  return tokenData;
}

function isTokenExpired(token) {
  if (!token || !token.expires_at) return true;
  return Date.now() / 1000 > token.expires_at - 60;
}

async function uploadContent(contentData) {
  if (isTokenExpired(tokenInfo)) {
    console.log("Token is expired or missing. Fetching a new one...");
    tokenInfo = await getAccessToken();
  }

  const response = await axios.post(API_URL, contentData, {
    headers: {
      Authorization: `Bearer ${tokenInfo.access_token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

async function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const filename = path.basename(filePath);
    const title = filename
      .replace(/\.(txt|md)$/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const contentData = {
      content: content,
      publisherId: PUBLISHER_ID,
      item_title: title,
      author: ["Automated Ingestion"],
      publication_date: new Date().toISOString().split("T")[0],
      type: "Article",
      pub_type: "technical",
      item_tags: ["automated", "ingestion"],
      evergreen: true,
      drm: ["aspen", "kallm"],
    };

    const result = await uploadContent(contentData);
    console.log(`✅ Successfully uploaded: ${title}`);
    console.log(`   Response: ${result.message}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to process ${filePath}:`,
      error.response ? error.response.data : error.message,
    );
    return false;
  }
}

function startFileWatcher(watchDirectory) {
  if (!fs.existsSync(watchDirectory)) {
    fs.mkdirSync(watchDirectory, { recursive: true });
    console.log(`Created watch directory: ${watchDirectory}`);
  }

  console.log(`🔍 Monitoring directory: ${watchDirectory}`);
  console.log("   Supported file types: .txt, .md");
  console.log("   Press Ctrl+C to stop");

  const watcher = chokidar.watch(watchDirectory, {
    ignored: /^\./,
    persistent: true,
  });

  watcher.on("add", async (filePath) => {
    if (path.extname(filePath).match(/\.(txt|md)$/)) {
      console.log(`📄 New file detected: ${filePath}`);
      // Small delay to ensure file write is complete
      setTimeout(() => processFile(filePath), 1000);
    }
  });

  process.on("SIGINT", () => {
    console.log("\n👋 Stopping file monitor...");
    watcher.close();
    process.exit(0);
  });
}

async function batchProcessDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    console.log(`Directory does not exist: ${directoryPath}`);
    return;
  }

  const files = fs.readdirSync(directoryPath);
  const supportedFiles = files.filter((file) => file.match(/\.(txt|md)$/));

  let processed = 0;
  let failed = 0;

  for (const filename of supportedFiles) {
    const filePath = path.join(directoryPath, filename);
    if (await processFile(filePath)) {
      processed++;
    } else {
      failed++;
    }

    // Rate limiting - avoid overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n📊 Batch processing complete:");
  console.log(`   ✅ Processed: ${processed} files`);
  console.log(`   ❌ Failed: ${failed} files`);
}

// --- Main Execution ---
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage:");
    console.log(
      "  node index.js watch <directory>     # Monitor directory for new files",
    );
    console.log(
      "  node index.js batch <directory>     # Process all files in directory",
    );
    console.log("  node index.js single <file_path>    # Process single file");
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case "watch":
        if (args[1]) startFileWatcher(args[1]);
        else console.log("Please specify a directory to watch");
        break;
      case "batch":
        if (args[1]) await batchProcessDirectory(args[1]);
        else console.log("Please specify a directory to process");
        break;
      case "single":
        if (args[1]) await processFile(args[1]);
        else console.log("Please specify a file to process");
        break;
      default:
        console.log("Invalid command. Use watch, batch, or single");
    }
  } catch (error) {
    console.error(
      "An error occurred:",
      error.response ? error.response.data : error.message,
    );
  }
}

main();
