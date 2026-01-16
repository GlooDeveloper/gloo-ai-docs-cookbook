import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import chokidar from "chokidar";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Type definitions
interface TokenInfo {
  access_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
}

interface ContentData {
  content: string;
  publisherId: string;
  item_title: string;
  item_subtitle?: string;
  author: string[];
  publication_date: string;
  type: string;
  pub_type: string;
  item_tags: string[];
  evergreen: boolean;
  drm: string[];
  item_summary?: string;
  item_image?: string;
  item_url?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  task_id: string | null;
  batch_id: string | null;
  processing_details: any | null;
}

type CommandType = "watch" | "batch" | "single";

interface ProcessingResult {
  processed: number;
  failed: number;
}

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
let tokenInfo: TokenInfo | null = null;

async function getAccessToken(): Promise<TokenInfo> {
  const body = "grant_type=client_credentials&scope=api/access";
  const response = await axios.post<TokenInfo>(TOKEN_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: { username: CLIENT_ID, password: CLIENT_SECRET },
  });
  const tokenData = response.data;
  (tokenData as any).expires_at =
    Math.floor(Date.now() / 1000) + tokenData.expires_in;
  return tokenData;
}

function isTokenExpired(token: TokenInfo | null): boolean {
  if (!token || !(token as any).expires_at) return true;
  return Date.now() / 1000 > (token as any).expires_at - 60;
}

async function uploadContent(contentData: ContentData): Promise<ApiResponse> {
  if (isTokenExpired(tokenInfo)) {
    console.log("Token is expired or missing. Fetching a new one...");
    tokenInfo = await getAccessToken();
  }

  const response = await axios.post<ApiResponse>(API_URL, contentData, {
    headers: {
      Authorization: `Bearer ${tokenInfo!.access_token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

function extractTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.(txt|md)$/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function createContentData(content: string, title: string): ContentData {
  return {
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
}

async function processFile(filePath: string): Promise<boolean> {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const filename = path.basename(filePath);
    const title = extractTitleFromFilename(filename);

    const contentData = createContentData(content, title);
    const result = await uploadContent(contentData);

    console.log(`✅ Successfully uploaded: ${title}`);
    console.log(`   Response: ${result.message}`);
    return true;
  } catch (error: any) {
    console.error(
      `❌ Failed to process ${filePath}:`,
      error.response ? error.response.data : error.message,
    );
    return false;
  }
}

function isSupportedFile(filePath: string): boolean {
  return path.extname(filePath).match(/\.(txt|md)$/) !== null;
}

function startFileWatcher(watchDirectory: string): void {
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

  watcher.on("add", async (filePath: string) => {
    if (isSupportedFile(filePath)) {
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

async function batchProcessDirectory(directoryPath: string): Promise<void> {
  if (!fs.existsSync(directoryPath)) {
    console.log(`Directory does not exist: ${directoryPath}`);
    return;
  }

  const files = fs.readdirSync(directoryPath);
  const supportedFiles = files.filter((file) => isSupportedFile(file));

  const result: ProcessingResult = { processed: 0, failed: 0 };

  for (const filename of supportedFiles) {
    const filePath = path.join(directoryPath, filename);
    if (await processFile(filePath)) {
      result.processed++;
    } else {
      result.failed++;
    }

    // Rate limiting - avoid overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n📊 Batch processing complete:");
  console.log(`   ✅ Processed: ${result.processed} files`);
  console.log(`   ❌ Failed: ${result.failed} files`);
}

function printUsage(): void {
  console.log("Usage:");
  console.log(
    "  npx ts-node index.ts watch <directory>     # Monitor directory for new files",
  );
  console.log(
    "  npx ts-node index.ts batch <directory>     # Process all files in directory",
  );
  console.log(
    "  npx ts-node index.ts single <file_path>    # Process single file",
  );
}

function validateCommand(command: string): command is CommandType {
  return ["watch", "batch", "single"].includes(command as CommandType);
}

// --- Main Execution ---
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  if (!validateCommand(command)) {
    console.log("Invalid command. Use watch, batch, or single");
    process.exit(1);
  }

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
    }
  } catch (error: any) {
    console.error(
      "An error occurred:",
      error.response ? error.response.data : error.message,
    );
    process.exit(1);
  }
}

main();
