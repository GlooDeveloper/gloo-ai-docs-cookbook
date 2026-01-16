/**
 * Gloo AI Upload Files - TypeScript Example
 *
 * This script demonstrates how to use the Gloo AI Data Engine Files API
 * to upload files directly for processing and AI-powered search.
 */

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import FormData from "form-data";
import * as dotenv from "dotenv";

dotenv.config();

// --- Type Definitions ---
interface TokenInfo {
  access_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  ingesting?: string[];
  duplicates?: string[];
}

interface MetadataResponse {
  success: boolean;
  message: string;
}

interface Metadata {
  item_title?: string;
  item_subtitle?: string;
  author?: string[];
  publication_date?: string;
  item_tags?: string[];
  item_summary?: string;
  item_url?: string;
  item_image?: string;
}

// --- Configuration ---
const CLIENT_ID = process.env.GLOO_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GLOO_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const PUBLISHER_ID = process.env.GLOO_PUBLISHER_ID || "your-publisher-id";

const TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const UPLOAD_URL = "https://platform.ai.gloo.com/ingestion/v2/files";
const METADATA_URL = "https://platform.ai.gloo.com/engine/v2/item";

// Supported file extensions
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".doc", ".docx"];

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
  console.log("GLOO_PUBLISHER_ID=your_publisher_id_here");
  process.exit(1);
}

// --- State Management ---
let tokenInfo: TokenInfo | null = null;

/**
 * Get a new access token from the OAuth2 endpoint.
 */
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

/**
 * Check if the current token is expired.
 */
function isTokenExpired(token: TokenInfo | null): boolean {
  if (!token || !(token as any).expires_at) return true;
  return Date.now() / 1000 > (token as any).expires_at - 60;
}

/**
 * Ensure we have a valid access token.
 */
async function ensureValidToken(): Promise<string> {
  if (isTokenExpired(tokenInfo)) {
    console.log("Token is expired or missing. Fetching a new one...");
    tokenInfo = await getAccessToken();
  }
  return tokenInfo!.access_token;
}

/**
 * Check if a file extension is supported.
 */
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Upload a single file to the Data Engine.
 */
async function uploadSingleFile(
  filePath: string,
  producerId: string | null = null
): Promise<UploadResponse> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!isSupportedFile(filePath)) {
    throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }

  const token = await ensureValidToken();
  const formData = new FormData();
  formData.append("files", fs.createReadStream(filePath));
  formData.append("publisher_id", PUBLISHER_ID);

  const config: any = {
    headers: {
      Authorization: `Bearer ${token}`,
      ...formData.getHeaders(),
    },
    timeout: 120000,
  };

  if (producerId) {
    config.params = { producer_id: producerId };
  }

  const response = await axios.post<UploadResponse>(UPLOAD_URL, formData, config);
  return response.data;
}

/**
 * Upload multiple files to the Data Engine.
 */
async function uploadMultipleFiles(filePaths: string[]): Promise<UploadResponse> {
  const token = await ensureValidToken();
  const formData = new FormData();

  let validFiles = 0;
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.log(`Warning: Skipping non-existent file: ${filePath}`);
      continue;
    }
    if (!isSupportedFile(filePath)) {
      console.log(`Warning: Skipping unsupported file: ${filePath}`);
      continue;
    }
    formData.append("files", fs.createReadStream(filePath));
    validFiles++;
  }

  if (validFiles === 0) {
    throw new Error("No valid files to upload");
  }

  formData.append("publisher_id", PUBLISHER_ID);

  const response = await axios.post<UploadResponse>(UPLOAD_URL, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...formData.getHeaders(),
    },
    timeout: 300000,
  });

  return response.data;
}

/**
 * Update metadata for an uploaded item.
 */
async function updateMetadata(
  itemId: string | null = null,
  producerId: string | null = null,
  metadata: Metadata = {}
): Promise<MetadataResponse> {
  if (!itemId && !producerId) {
    throw new Error("Either itemId or producerId must be provided");
  }

  const token = await ensureValidToken();
  const data: any = {
    publisher_id: PUBLISHER_ID,
    ...(itemId && { item_id: itemId }),
    ...(producerId && { producer_id: producerId }),
    ...metadata,
  };

  const response = await axios.post<MetadataResponse>(METADATA_URL, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  return response.data;
}

/**
 * Upload a single file command handler.
 */
async function cmdUploadSingle(
  filePath: string,
  producerId: string | null = null
): Promise<void> {
  try {
    console.log(`Uploading: ${filePath}`);
    if (producerId) {
      console.log(`  Producer ID: ${producerId}`);
    }

    const result = await uploadSingleFile(filePath, producerId);

    console.log("Upload successful!");
    console.log(`  Message: ${result.message || "N/A"}`);

    if (result.ingesting && result.ingesting.length > 0) {
      console.log(`  Ingesting: ${result.ingesting.length} file(s)`);
      result.ingesting.forEach((id) => console.log(`    - ${id}`));
    }

    if (result.duplicates && result.duplicates.length > 0) {
      console.log(`  Duplicates: ${result.duplicates.length} file(s)`);
      result.duplicates.forEach((id) => console.log(`    - ${id}`));
    }
  } catch (error: any) {
    console.error(
      "Upload failed:",
      error.response ? error.response.data : error.message
    );
    process.exit(1);
  }
}

/**
 * Batch upload command handler.
 */
async function cmdUploadBatch(directoryPath: string): Promise<void> {
  if (!fs.existsSync(directoryPath)) {
    console.error(`Directory does not exist: ${directoryPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(directoryPath);
  if (!stats.isDirectory()) {
    console.error(`Path is not a directory: ${directoryPath}`);
    process.exit(1);
  }

  // Find all supported files
  const files = fs.readdirSync(directoryPath);
  const supportedFiles = files.filter((file) =>
    SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase())
  );

  if (supportedFiles.length === 0) {
    console.log(`No supported files found in: ${directoryPath}`);
    return;
  }

  console.log(`Found ${supportedFiles.length} file(s) to upload`);

  let processed = 0;
  let failed = 0;

  for (const filename of supportedFiles) {
    const filePath = path.join(directoryPath, filename);
    try {
      console.log(`\nUploading: ${filename}`);
      const result = await uploadSingleFile(filePath);

      if (result.ingesting && result.ingesting.length > 0) {
        console.log(`  Ingesting: ${result.ingesting[0]}`);
        processed++;
      } else if (result.duplicates && result.duplicates.length > 0) {
        console.log(`  Duplicate detected: ${result.duplicates[0]}`);
        processed++;
      } else {
        console.log(`  Result: ${result.message || "Unknown"}`);
        processed++;
      }
    } catch (error: any) {
      console.error(
        `  Failed:`,
        error.response ? error.response.data : error.message
      );
      failed++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\nBatch upload complete:`);
  console.log(`  Processed: ${processed} file(s)`);
  console.log(`  Failed: ${failed} file(s)`);
}

/**
 * Upload with metadata command handler.
 */
async function cmdUploadWithMetadata(
  filePath: string,
  metadata: Metadata
): Promise<void> {
  try {
    const producerId = `upload-${Date.now()}`;
    console.log(`Uploading: ${filePath}`);
    console.log(`  Producer ID: ${producerId}`);

    const result = await uploadSingleFile(filePath, producerId);

    if (result.ingesting && result.ingesting.length > 0) {
      const itemId = result.ingesting[0];
      console.log(`  Item ID: ${itemId}`);

      if (Object.keys(metadata).length > 0) {
        console.log("Updating metadata...");
        const metaResult = await updateMetadata(itemId, null, metadata);
        console.log(`  Metadata updated: ${metaResult.message || "Success"}`);
      }
    } else {
      console.log(`  Result: ${result.message || "Unknown"}`);
    }
  } catch (error: any) {
    console.error(
      "Operation failed:",
      error.response ? error.response.data : error.message
    );
    process.exit(1);
  }
}

/**
 * Print usage information.
 */
function printUsage(): void {
  console.log("Usage:");
  console.log(
    "  npx ts-node index.ts single <file_path> [producer_id]  # Upload single file"
  );
  console.log(
    "  npx ts-node index.ts batch <directory>                  # Upload all files in directory"
  );
  console.log(
    "  npx ts-node index.ts meta <file_path> --title <title>   # Upload with metadata"
  );
  console.log("");
  console.log("Examples:");
  console.log(
    "  npx ts-node index.ts single ../sample_files/developer_happiness.txt"
  );
  console.log(
    "  npx ts-node index.ts single ../sample_files/developer_happiness.txt my-doc-001"
  );
  console.log("  npx ts-node index.ts batch ../sample_files");
  console.log(
    '  npx ts-node index.ts meta ../sample_files/developer_happiness.txt --title "Developer Happiness"'
  );
}

/**
 * Parse metadata arguments from command line.
 */
function parseMetadataArgs(args: string[]): Metadata {
  const metadata: Metadata = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && i + 1 < args.length) {
      metadata.item_title = args[i + 1];
      i++;
    } else if (args[i] === "--author" && i + 1 < args.length) {
      metadata.author = [args[i + 1]];
      i++;
    } else if (args[i] === "--tags" && i + 1 < args.length) {
      metadata.item_tags = args[i + 1].split(",");
      i++;
    }
  }
  return metadata;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  try {
    switch (command) {
      case "single":
        if (!args[1]) {
          console.error("Error: Please specify a file to upload");
          printUsage();
          process.exit(1);
        }
        await cmdUploadSingle(args[1], args[2] || null);
        break;

      case "batch":
        if (!args[1]) {
          console.error("Error: Please specify a directory");
          printUsage();
          process.exit(1);
        }
        await cmdUploadBatch(args[1]);
        break;

      case "meta":
        if (!args[1]) {
          console.error("Error: Please specify a file to upload");
          printUsage();
          process.exit(1);
        }
        const metadata = parseMetadataArgs(args.slice(2));
        await cmdUploadWithMetadata(args[1], metadata);
        break;

      default:
        console.error(`Error: Invalid command '${command}'`);
        printUsage();
        process.exit(1);
    }
  } catch (error: any) {
    console.error("An error occurred:", error.message);
    process.exit(1);
  }
}

main();
