const axios = require("axios");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
require("dotenv").config();

// --- Configuration ---
const API_KEY = process.env.GLOO_API_KEY || "";
const API_URL = "https://platform.ai.gloo.com/ingestion/v1/real_time_upload";
const PUBLISHER_ID = "your-publisher-id"; // Replace with your publisher ID

// Validate API key
if (!API_KEY) {
  console.error("Error: GLOO_API_KEY must be set");
  console.log("Create a .env file with your API key:");
  console.log("GLOO_API_KEY=your_api_key_here");
  process.exit(1);
}

async function uploadContent(contentData) {
  const response = await axios.post(API_URL, contentData, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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
